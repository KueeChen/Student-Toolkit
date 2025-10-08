"use strict";
console.log('content.js loaded');

// 监听来自popup或background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fillForm') {
    if (window.resumeFormFiller) {
      try {
        const filledCount = window.resumeFormFiller.fillAllForms();
        sendResponse({ status: 'ok', filledCount });
      } catch (e) {
        sendResponse({ status: 'error', message: '自动填写异常: ' + (e && e.message ? e.message : e) });
      }
    } else {
      sendResponse({ status: 'error', message: 'FormFiller未初始化' });
    }
    return true;
  }
  if (message.action === 'ping') {
    sendResponse({ ok: true });
    return true;
  }
  if (message.action === 'getFormStats') {
    try {
      if (!window.resumeFormFiller) {
        sendResponse({ success: false });
        return true;
      }
      const fields = window.resumeFormFiller.findFormFields();
      const total = fields.length;
      const filled = fields.filter(f => f.element && f.element.value && f.element.value.trim() !== '').length;
      const empty = total - filled;
      sendResponse({ success: true, data: { total, filled, empty } });
    } catch (e) {
      sendResponse({ success: false });
    }
    return true;
  }
});

class FormFiller {
  constructor() {
    this.parser = new ResumeParser();
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadResumeData();
    
    // 如果启用了自动填写，延迟执行以避免页面未完全加载
    if (this.settings.autoFill !== false) {
      setTimeout(() => {
        this.fillAllForms();
      }, 2000);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['autoFill', 'showNotification']);
      this.settings = {
        autoFill: result.autoFill !== false,
        showNotification: result.showNotification !== false
      };
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  async loadResumeData() {
    try {
      const result = await chrome.storage.local.get(['resumeData', 'currentTemplate']);
      if (result.resumeData) {
        this.parser.resumeData = result.resumeData;
      }
      this.currentTemplate = result.currentTemplate || '简历模板.md';
    } catch (error) {
      console.error('加载简历数据失败:', error);
    }
  }

  // 查找页面中的所有表单字段
  findFormFields() {
    const fields = [];
    // 更全面的选择器，包含常见属性
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea, select, input[aria-label], input[data-label], input[autocomplete]');
    inputs.forEach(input => {
      const fieldInfo = this.getFieldInfo(input);
      if (fieldInfo) {
        fields.push({
          element: input,
          ...fieldInfo
        });
      }
    });
    return fields;
  }

  // 获取字段信息
  getFieldInfo(element) {
    const tagName = element.tagName.toLowerCase();
    const type = element.type || '';
    const name = element.name || '';
    const id = element.id || '';
    const placeholder = element.placeholder || '';
    const className = element.className || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    const dataLabel = element.getAttribute('data-label') || '';
    const autocomplete = element.getAttribute('autocomplete') || '';
    let label = '';
    // 1. 直接label属性
    if (element.labels && element.labels.length > 0) {
      label = element.labels[0].textContent.trim();
    } else {
      // 2. for属性
      const labelElement = document.querySelector(`label[for="${id}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim();
      } else {
        // 3. 父级label
        const parentLabel = element.closest('label');
        if (parentLabel) {
          label = parentLabel.textContent.trim();
        } else {
          // 4. 上一个兄弟节点label
          let prev = element.previousElementSibling;
          while (prev) {
            if (prev.tagName && prev.tagName.toLowerCase() === 'label') {
              label = prev.textContent.trim();
              break;
            }
            prev = prev.previousElementSibling;
          }
          // 5. 上级div内的label
          if (!label) {
            const parentDiv = element.closest('div');
            if (parentDiv) {
              const divLabel = parentDiv.querySelector('label');
              if (divLabel) label = divLabel.textContent.trim();
            }
          }
        }
      }
    }
    // 6. 占位符文本也作为label补充
    let contextText = '';
    if (element.parentElement) {
      contextText = element.parentElement.textContent.trim();
    }
    // 7. 递归查找父级和同级文本节点（增强适配）
    let extraLabels = [];
    let cur = element.parentElement;
    let depth = 0;
    while (cur && depth < 4) { // 最多递归4层，防止过深
      // 查找同级的文本节点和常见label容器
      Array.from(cur.childNodes).forEach(node => {
        if (node !== element && node.nodeType === 3 && node.textContent.trim().length > 0) {
          extraLabels.push(node.textContent.trim());
        }
        if (node !== element && node.nodeType === 1) {
          // 常见label容器
          if (['label', 'span', 'div', 'p', 'strong', 'b'].includes(node.tagName.toLowerCase())) {
            const txt = node.textContent.trim();
            if (txt.length > 0 && txt.length < 20) extraLabels.push(txt);
          }
        }
      });
      cur = cur.parentElement;
      depth++;
    }
    // 构建字段标识符，包含更多上下文
    const identifiers = [name, id, placeholder, label, className, contextText, ariaLabel, dataLabel, autocomplete, ...extraLabels].filter(Boolean);
    return {
      tagName,
      type,
      name,
      id,
      placeholder,
      label,
      className,
      contextText,
      ariaLabel,
      dataLabel,
      autocomplete,
      extraLabels,
      identifiers: identifiers.join(' ').toLowerCase()
    };
  }

  // 填写所有表单
  fillAllForms() {
    const fields = this.findFormFields();
    let filledCount = 0;
    fields.forEach(field => {
      const idt = field.identifiers || '';
      if (/search|搜索|关键字|keyword/.test(idt)) {
        return;
      }
      // 先取标准键，再取值并做归一化，避免 [object Object]
      let stdKey = this.parser.findMatchingKeyFuzzy(field.identifiers);
      let value = '';
      if (stdKey && this.parser) {
        const rawByStdKey = this.parser.getValueByField(stdKey);
        value = this.normalizeValueByKey(stdKey, rawByStdKey);
      }
      // 后备：原有模糊匹配直接取值
      if (!value) {
        const raw = this.parser.findMatchingFieldFuzzy(field.identifiers);
        value = this.normalizeValueByKey(stdKey || '', raw);
      }
      // 再后备：启发式键
      if (!value) {
        const guessedKey = this.guessKeyByAttributes(field);
        if (guessedKey) {
          const raw = this.parser.resumeData ? this.parser.resumeData[guessedKey] : '';
          value = this.normalizeValueByKey(guessedKey, raw);
          if (!stdKey) stdKey = guessedKey;
        }
      }

      // 短字段防呆：长度/格式约束，避免误填长文本
      if (stdKey === '姓名' && value && value.length > 40) value = '';
      if (stdKey === '手机号码' && value && !/^\d{6,20}$/.test(String(value).replace(/\D/g, ''))) value = '';
      if (stdKey === '身份证号' && value && !/^\w{8,30}$/.test(String(value).replace(/\s/g, ''))) value = '';
      if (stdKey === '邮箱地址' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) value = '';

      if (value && this.shouldFillField(field, value)) {
        this.fillField(field.element, value);
        filledCount++;
        if (this.settings.showNotification) {
          this.showFieldNotification(field, value);
        }
      } else {
        this.highlightField(field.element, 'fail');
        console.warn('未能自动识别字段:', field);
      }
    });
    if (filledCount > 0 && this.settings.showNotification) {
      this.showSummaryNotification(filledCount);
    }
    return filledCount;
  }

  isPlainObject(v) {
    return Object.prototype.toString.call(v) === '[object Object]';
  }

  normalizeValueByKey(stdKey, raw) {
    if (raw == null) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw);
    }
    // 日期对象/ISO字符串
    if (raw instanceof Date) {
      const y = raw.getFullYear();
      const m = String(raw.getMonth() + 1).padStart(2, '0');
      const d = String(raw.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // 地址类对象
    if (this.isPlainObject(raw)) {
      const keys = Object.keys(raw);
      // 针对地址字段，拼接常见层级
      if (/地址|住址|address/.test(stdKey)) {
        const parts = ['province', 'city', 'district', 'street', 'detail', 'addr', 'address']
          .map(k => raw[k])
          .filter(Boolean);
        if (parts.length) return parts.join(' ');
      }
      // 针对身份证等结构化
      if (/身份证|id/.test(stdKey)) {
        return raw.number || raw.id || raw.code || '';
      }
      // 通用：尝试取常见的 value/name/text
      const prefer = raw.value || raw.name || raw.text || raw.label;
      if (prefer) return String(prefer);
      // 兜底序列化（避免写入 [object Object]）
      try { return JSON.stringify(raw); } catch (e) { return ''; }
    }
    // 数组：拼接
    if (Array.isArray(raw)) {
      const arr = raw.map(v => this.isPlainObject(v) ? (v.value || v.name || v.text || v.label || '') : String(v)).filter(Boolean);
      return arr.join(' ');
    }
    // 其他类型兜底
    try { return String(raw); } catch (e) { return ''; }
  }

  // 判断是否应该填写该字段
  shouldFillField(field, value) {
    // 如果字段已经有值，不覆盖
    if (field.element.value && field.element.value.trim() !== '') {
      return false;
    }

    // 特殊字段处理
    if (field.type === 'email' && !value.includes('@')) {
      return false;
    }

    if (field.type === 'tel' && !/^\d+$/.test(value.replace(/[-\s]/g, ''))) {
      return false;
    }

    return true;
  }

  // 填写单个字段（增强下拉框和自定义下拉适配）
  fillField(element, value) {
    const tagName = element.tagName.toLowerCase();
    // 强制安全字符串化，避免 [object Object]
    const toSafeString = (val) => {
      if (val == null) return '';
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
      if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      if (Array.isArray(val)) {
        return val.map(v => toSafeString(v)).filter(Boolean).join(' ');
      }
      if (this.isPlainObject(val)) {
        const prefer = val.value || val.name || val.text || val.label || val.number || val.id || val.code;
        if (prefer) return String(prefer);
        try { return JSON.stringify(val); } catch (e) { return ''; }
      }
      try { return String(val); } catch (e) { return ''; }
    };
    const safeValue = toSafeString(value);

    if (tagName === 'input') {
      element.value = safeValue;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (tagName === 'textarea') {
      element.value = safeValue;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (tagName === 'select') {
      const valLower = safeValue.toLowerCase();
      const options = Array.from(element.options);
      let matchedOption = options.find(option => 
        option.text.toLowerCase().includes(valLower) ||
        option.value.toLowerCase().includes(valLower)
      );
      if (!matchedOption && safeValue === '男') matchedOption = options.find(option => option.text.includes('男') || option.value.includes('male'));
      if (!matchedOption && safeValue === '女') matchedOption = options.find(option => option.text.includes('女') || option.value.includes('female'));
      if (matchedOption) {
        element.value = matchedOption.value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      if (element.getAttribute('role') === 'combobox' || element.getAttribute('role') === 'listbox') {
        element.click();
        setTimeout(() => {
          const listbox = document.querySelector('[role="listbox"]');
          if (!listbox) return;
          const options = Array.from(listbox.querySelectorAll('[role="option"]'));
          let matched = options.find(opt => opt.textContent.trim().includes(safeValue));
          if (!matched && safeValue === '男') matched = options.find(opt => opt.textContent.includes('男') || opt.textContent.toLowerCase().includes('male'));
          if (!matched && safeValue === '女') matched = options.find(opt => opt.textContent.includes('女') || opt.textContent.toLowerCase().includes('female'));
          if (matched) matched.click();
        }, 200);
      }
    }
  }

  // 显示字段填写通知
  showFieldNotification(field, value) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 300px;
      word-break: break-word;
    `;
    
    const fieldName = field.label || field.placeholder || field.name || '未知字段';
    notification.textContent = `已填写: ${fieldName} = ${value}`;
    
    document.body.appendChild(notification);
    
    // 高亮字段
    this.highlightField(field.element);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  // 显示总结通知
  showSummaryNotification(filledCount) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #007bff;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      font-size: 16px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    notification.textContent = `自动填写完成！共填写了 ${filledCount} 个字段`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  // 高亮字段，支持失败高亮
  highlightField(element, type = 'success') {
    const originalBackground = element.style.backgroundColor;
    const originalBorder = element.style.border;
    if (type === 'fail') {
      element.style.backgroundColor = '#ffeaea';
      element.style.border = '2px solid #ff4d4f';
    } else {
      element.style.backgroundColor = '#e6ffed';
      element.style.border = '2px solid #52c41a';
    }
    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
      element.style.border = originalBorder;
    }, 2000);
  }

  // 手动填写指定字段
  fillSpecificField(fieldIdentifier, value) {
    const fields = this.findFormFields();
    const targetField = fields.find(field => 
      field.identifiers.includes(fieldIdentifier.toLowerCase())
    );
    
    if (targetField) {
      this.fillField(targetField.element, value);
      return true;
    }
    
    return false;
  }

  // 获取页面表单统计信息
  getFormStats() {
    const fields = this.findFormFields();
    const filledFields = fields.filter(field => field.element.value && field.element.value.trim() !== '');
    
    return {
      total: fields.length,
      filled: filledFields.length,
      empty: fields.length - filledFields.length
    };
  }

  // 基于属性与上下文的启发式字段键推断
  guessKeyByAttributes(field) {
    const text = (field.identifiers || '').toLowerCase();
    const checks = [
      { key: '邮箱地址', re: /(email|电子邮件|邮箱)/ },
      { key: '手机号码', re: /(mobile|phone|tel|手机号|电话|联系电话)/ },
      { key: '身份证号', re: /(身份证|id\s*card|idnumber|id\s*number|identity|shenfenzheng|sfz)/ },
      { key: '现居地址', re: /(地址|address|住址|通讯地址|家庭住址|现居|居住)/ },
      { key: '姓名', re: /(姓名|full\s*name|名字|name)/ },
      { key: '所在城市', re: /(城市|city)/ },
      { key: '出生日期', re: /(出生|生日|date\s*of\s*birth|dob|birth)/ },
      { key: '性别', re: /(性别|gender|male|female|男|女)/ }
    ];
    for (const c of checks) {
      if (c.re.test(text)) return c.key;
    }
    // 针对 HTML5 autocomplete 提示
    const ac = (field.autocomplete || '').toLowerCase();
    if (/email/.test(ac)) return '邮箱地址';
    if (/(tel|mobile|phone)/.test(ac)) return '手机号码';
    if (/name/.test(ac)) return '姓名';
    if (/address/.test(ac)) return '现居地址';
    if (/bday|birthday|birth|dob/.test(ac)) return '出生日期';
    return '';
  }
}

// 初始化表单填写器
const formFiller = new FormFiller();

// 暴露给控制台或全局消息监听器使用
window.resumeFormFiller = formFiller;

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {action: 'testFill'}, function(response) {
    // 处理response
  });
}); 