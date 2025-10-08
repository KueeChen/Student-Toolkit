// 引入TxtResumeParser
let txtParser;
if (typeof TxtResumeParser !== 'undefined') {
  txtParser = new TxtResumeParser();
}

class OptionsManager {
  constructor() {
    this.parser = new ResumeParser();
    this.currentTemplate = '简历模板.md';
    this.init();
  }

  async init() {
    this.bindEvents();
    // 仅通用模板，去除选择逻辑
    this.loadSettings();
    this.loadResumeData();
    // 渲染在线编辑表单
    this.renderOnlineForm();
  }

  bindEvents() {
    // 文件上传相关
    const fileUpload = document.getElementById('fileUpload');
    const fileInput = document.getElementById('fileInput');

    fileUpload.addEventListener('click', () => fileInput.click());
    fileUpload.addEventListener('dragover', this.handleDragOver.bind(this));
    fileUpload.addEventListener('dragleave', this.handleDragLeave.bind(this));
    fileUpload.addEventListener('drop', this.handleDrop.bind(this));
    fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    // 按钮事件
    document.getElementById('saveSettings').addEventListener('click', this.saveSettings.bind(this));
    document.getElementById('clearData').addEventListener('click', this.clearData.bind(this));
    document.getElementById('testFill').addEventListener('click', this.testFill.bind(this));
    document.getElementById('downloadTemplate').addEventListener('click', this.downloadTemplate.bind(this));

    // 新增：直接上传md简历
    const uploadMdBtn = document.getElementById('uploadMdResumeBtn');
    const mdInput = document.getElementById('mdResumeInput');
    uploadMdBtn.addEventListener('click', () => mdInput.click());
    mdInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.name.endsWith('.md')) {
        this.showStatus('请选择 .md 格式的文件', 'error');
        return;
      }
      await this.processFile(file);
    });

    // txt简历上传相关
    document.getElementById('uploadTxtResumeBtn').addEventListener('click', () => {
      document.getElementById('txtResumeInput').click();
    });
    document.getElementById('txtResumeInput').addEventListener('change', this.handleTxtResumeSelect.bind(this));
    document.getElementById('copyTxtMdBtn').addEventListener('click', this.copyTxtMdToClipboard.bind(this));
    document.getElementById('downloadTxtMdBtn').addEventListener('click', this.downloadTxtMd.bind(this));

    // AI解析相关
    document.getElementById('uploadTxtForAiBtn').addEventListener('click', () => {
      document.getElementById('txtForAiInput').click();
    });
    document.getElementById('txtForAiInput').addEventListener('change', this.handleTxtForAiSelect.bind(this));
    document.getElementById('copyAiResultBtn').addEventListener('click', this.copyAiResultToClipboard.bind(this));
    document.getElementById('downloadAiResultBtn').addEventListener('click', this.downloadAiResult.bind(this));
    document.getElementById('useAiResultBtn').addEventListener('click', this.useAiResult.bind(this));
    document.getElementById('saveAiResultBtn').addEventListener('click', this.saveAiResultToLocal.bind(this));

    // 移除模板下拉相关事件（仅保留通用模板）
    // document.getElementById('templateSelector').addEventListener('change', this.handleTemplateChange.bind(this));

    // 在线编辑相关
    document.getElementById('loadCurrentResumeBtn').addEventListener('click', this.loadCurrentResumeToEditor.bind(this));
    document.getElementById('applyOnlineMdBtn').addEventListener('click', this.applyOnlineMd.bind(this));
    document.getElementById('downloadOnlineMdBtn').addEventListener('click', this.downloadOnlineMd.bind(this));
  }

  handleDragOver(e) {
    e.preventDefault();
    document.getElementById('fileUpload').classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('fileUpload').classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    document.getElementById('fileUpload').classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  async processFile(file) {
    if (!file.name.endsWith('.md')) {
      this.showStatus('请选择 .md 格式的文件', 'error');
      return;
    }

    try {
      const content = await this.readFile(file);
      console.log('--- DEBUG: 1. Raw file content ---');
      console.log(content);

      const resumeData = this.parser.parseMarkdown(content);
      
      console.log('--- DEBUG: 2. Parsed resumeData object ---');
      // 使用JSON.stringify格式化输出，方便查看嵌套结构
      console.log(JSON.stringify(resumeData, null, 2));

      if (Object.keys(resumeData).length === 0) {
        this.showStatus('解析失败，简历为空。请按F12打开控制台查看详细日志。', 'error');
        this.updatePreview({}); // 清空预览
        return;
      }

      // 保存到存储
      await chrome.storage.local.set({ resumeData: resumeData });
      this.currentResumeData = resumeData; // 保存到实例，方便下载
      
      this.showStatus(`成功解析简历！`, 'success');
      this.updatePreview(resumeData); // 使用新的预览函数
      // 自动填充在线编辑表单
      await this.loadCurrentResumeToEditor();
      
    } catch (error) {
      console.error('处理文件时出错:', error);
      this.showStatus('读取或解析文件失败: ' + error.message, 'error');
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 5000);
  }

  updatePreview(data) {
    const previewContainer = document.getElementById('resumePreview');
    const contentContainer = document.getElementById('previewContent');
    contentContainer.innerHTML = ''; // 清空旧内容

    // 顶部操作按钮
    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    actions.innerHTML = `
        <button id="copyJsonBtn" class="action-btn">复制JSON</button>
        <button id="downloadJsonBtn" class="action-btn">下载JSON</button>
    `;
    contentContainer.appendChild(actions);

    document.getElementById('copyJsonBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        this.showStatus('已复制到剪贴板', 'success');
    });

    document.getElementById('downloadJsonBtn').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "resume_data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        this.showStatus('正在下载...', 'info');
    });

    // 遍历并显示数据
    for (const sectionKey in data) {
      const sectionData = data[sectionKey];
      
      const sectionDetails = document.createElement('details');
      sectionDetails.open = true; // 默认展开

      const sectionSummary = document.createElement('summary');
      sectionSummary.textContent = sectionKey;
      sectionDetails.appendChild(sectionSummary);

      const sectionContent = document.createElement('div');
      sectionContent.className = 'section-content';

      for (const fieldKey in sectionData) {
        const fieldValue = sectionData[fieldKey];
        const fieldItem = document.createElement('div');
        fieldItem.className = 'field-item';
        
        const fieldName = document.createElement('span');
        fieldName.className = 'field-name';
        fieldName.textContent = fieldKey.replace(/_en$/, ' (English)');
        
        const fieldValuePre = document.createElement('pre');
        fieldValuePre.className = 'field-value';
        fieldValuePre.textContent = fieldValue;

        fieldItem.appendChild(fieldName);
        fieldItem.appendChild(fieldValuePre);
        sectionContent.appendChild(fieldItem);
      }
      
      sectionDetails.appendChild(sectionContent);
      contentContainer.appendChild(sectionDetails);
    }

    previewContainer.style.display = 'block';
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['autoFill', 'showNotification']);
      document.getElementById('autoFill').checked = result.autoFill !== false;
      document.getElementById('showNotification').checked = result.showNotification !== false;
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  async loadResumeData() {
    try {
      const result = await chrome.storage.local.get(['resumeData']);
      if (result.resumeData && Object.keys(result.resumeData).length > 0) {
        this.parser.resumeData = result.resumeData;
        this.currentResumeData = result.resumeData; // 保存到实例
        this.updatePreview(result.resumeData);
        this.showStatus('已加载保存的简历数据', 'info');
        // 自动填充在线编辑表单
        await this.loadCurrentResumeToEditor();
      } else {
        console.log("本地存储中没有简历数据或数据为空。");
        this.updatePreview({}); // 确保在没有数据时清空预览
      }
      if (result.currentTemplate) {
        this.currentTemplate = result.currentTemplate;
        document.getElementById('templateSelector').value = result.currentTemplate;
      }
    } catch (error) {
      console.error('加载简历数据失败:', error);
    }
  }

  // ---------------- 在线编辑（结构与模板对应） ----------------
  getFieldsSpec() {
    return [
      { section: '基本信息', fields: ['姓名','性别','出生日期','政治面貌','民族','身份证号','手机号码','邮箱地址','现居地址','籍贯','所在城市','身高','体重','国籍','家庭住址','出生地','户口所在地'] },
      { section: '教育背景', fields: ['最高学历','毕业院校','专业','毕业时间','学位','GPA','第一学历','本科毕业院校','本科专业','本科毕业时间','本科学位','本科GPA'] },
      { section: '工作经历', fields: ['当前职位','工作年限','期望薪资','期望工作地点','期望职位'] },
      { section: '技能特长', fields: ['技能证书','语言能力','计算机技能','证书资质'] },
      { section: '个人特质', fields: ['兴趣爱好','特长','性格特点','自我评价','自我描述','职业规划'] },
    ];
  }

  isLongField(field) {
    return ['现居地址','家庭住址','自我评价','自我描述','项目描述','项目职责','项目成果','实习内容','实习收获','工作内容','工作收获','备注','技能证书','语言能力','计算机技能','证书资质','兴趣爱好','特长','职业规划'].includes(field);
  }

  renderOnlineForm() {
    const container = document.getElementById('onlineEditContent');
    if (!container) return;
    container.innerHTML = '';
    const spec = this.getFieldsSpec();
    spec.forEach(group => {
      const sec = document.createElement('div');
      sec.className = 'section';
      const h3 = document.createElement('h3');
      h3.textContent = group.section;
      sec.appendChild(h3);
      group.fields.forEach(f => {
        const row = document.createElement('div');
        row.className = 'field-item';
        const label = document.createElement('label');
        label.className = 'field-name';
        label.setAttribute('for', `f_${group.section}_${f}`);
        label.textContent = f;
        const holder = document.createElement('div');
        holder.className = 'field-value';
        let input;
        if (this.isLongField(f)) {
          input = document.createElement('textarea');
          input.rows = 3;
        } else {
          input = document.createElement('input');
          input.type = 'text';
        }
        input.id = `f_${group.section}_${f}`;
        input.style.width = '100%';
        holder.appendChild(input);
        row.appendChild(label);
        row.appendChild(holder);
        sec.appendChild(row);
      });
      container.appendChild(sec);
    });
  }

  // 将 storage 中的简历数据填充进在线编辑表单
  async loadCurrentResumeToEditor() {
    try {
      const result = await chrome.storage.local.get(['resumeData']);
      const data = result.resumeData || {};
      const spec = this.getFieldsSpec();
      spec.forEach(group => {
        const sectionObj = data[group.section] || {};
        group.fields.forEach(f => {
          const el = document.getElementById(`f_${group.section}_${f}`);
          if (el) el.value = sectionObj[f] || '';
        });
      });
      this.showInlineStatus('已加载当前简历数据到编辑区', 'success');
    } catch (e) {
      this.showInlineStatus('加载当前简历失败', 'error');
    }
  }

  // 从在线编辑表单生成 Markdown（与解析器兼容的纯中文模板）
  buildMdFromForm() {
    const spec = this.getFieldsSpec();
    const parts = ['# 个人简历'];
    spec.forEach(group => {
      parts.push('\n---\n');
      parts.push(`## ${group.section}`);
      group.fields.forEach(f => {
        const el = document.getElementById(`f_${group.section}_${f}`);
        const v = el ? (el.value || '').trim() : '';
        parts.push(`\n### ${f}\n${v}`);
      });
    });
    return parts.join('\n');
  }

  async applyOnlineMd() {
    const md = this.buildMdFromForm();
    try {
      const resumeData = this.parser.parseMarkdown(md);
      await chrome.storage.local.set({ resumeData });
      this.currentResumeData = resumeData;
      this.updatePreview(resumeData);
      this.showInlineStatus('已保存到插件并解析成功', 'success');
    } catch (e) {
      this.showInlineStatus('保存失败：' + e.message, 'error');
    }
  }

  downloadOnlineMd() {
    const md = this.buildMdFromForm();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '我的简历.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showInlineStatus('已下载为.md文件', 'success');
  }

  showInlineStatus(message, type) {
    const status = document.getElementById('onlineEditStatus');
    if (!status) return;
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    setTimeout(() => { status.style.display = 'none'; }, 4000);
  }

  async saveSettings() {
    try {
      const settings = {
        autoFill: document.getElementById('autoFill').checked,
        showNotification: document.getElementById('showNotification').checked
      };
      
      await chrome.storage.local.set(settings);
      this.showStatus('设置已保存', 'success');
    } catch (error) {
      this.showStatus('保存设置失败: ' + error.message, 'error');
    }
  }

  async clearData() {
    if (confirm('确定要清空所有简历数据吗？此操作不可恢复。')) {
      try {
        await chrome.storage.local.clear();
        this.parser.clear();
        document.getElementById('resumePreview').style.display = 'none';
        this.showStatus('数据已清空', 'success');
      } catch (error) {
        this.showStatus('清空数据失败: ' + error.message, 'error');
      }
    }
  }

  async testFill() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        this.showStatus('无法获取当前标签页', 'error');
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // 发送消息给content script进行测试填写
          chrome.runtime.sendMessage({ action: 'testFill' });
        }
      });
      
      this.showStatus('测试填写已启动，请查看当前页面', 'info');
    } catch (error) {
      this.showStatus('测试填写失败: ' + error.message, 'error');
    }
  }

  downloadTemplate() {
    // 创建模板文件下载
    const templateContent = `# 个人简历模板 / Personal Resume Template

## 基本信息 / Basic Information

### 姓名 / Name
**中文**: 张三
**English**: Zhang San

### 性别 / Gender
**中文**: 男
**English**: Male

### 出生日期 / Date of Birth
**中文**: 1995年1月1日
**English**: January 1, 1995

### 政治面貌 / Political Status
**中文**: 群众
**English**: Mass

### 手机号码 / Phone Number
**中文**: 13800138000
**English**: 13800138000

### 邮箱地址 / Email Address
**中文**: zhangsan@example.com
**English**: zhangsan@example.com

### 现居地址 / Current Address
**中文**: 北京市朝阳区
**English**: Chaoyang District, Beijing

---

## 教育背景 / Education Background

### 最高学历 / Highest Education
**中文**: 本科
**English**: Bachelor's Degree

### 毕业院校 / University
**中文**: 北京大学
**English**: Peking University

### 专业 / Major
**中文**: 计算机科学与技术
**English**: Computer Science and Technology

### 毕业时间 / Graduation Date
**中文**: 2017年6月
**English**: June 2017

---

## 工作经历 / Work Experience

### 工作年限 / Years of Experience
**中文**: 3年
**English**: 3 years

### 期望薪资 / Expected Salary
**中文**: 15k-20k
**English**: 15k-20k

---

## 技能特长 / Skills & Expertise

### 专业技能 / Professional Skills
**中文**: JavaScript, Python, React, Node.js
**English**: JavaScript, Python, React, Node.js

### 语言能力 / Language Skills
**中文**: 英语四级，普通话
**English**: CET-4, Mandarin

---

## 个人特质 / Personal Characteristics

### 兴趣爱好 / Hobbies & Interests
**中文**: 编程、阅读、运动
**English**: Programming, Reading, Sports

### 自我评价 / Self-Evaluation
**中文**: 热爱技术，学习能力强，团队协作良好
**English**: Passionate about technology, strong learning ability, good teamwork

---

## 实习经历 / Internship Experience

### 实习公司 / Internship Company
**中文**: 腾讯科技
**English**: Tencent Technology

### 实习职位 / Internship Position
**中文**: 前端开发实习生
**English**: Frontend Development Intern

### 实习时间 / Internship Period
**中文**: 2016年6月-2016年9月
**English**: June 2016 - September 2016

### 实习内容 / Internship Content
**中文**: 参与微信小程序开发，负责用户界面设计和功能实现
**English**: Participated in WeChat Mini Program development, responsible for UI design and feature implementation

---

## 项目经历 / Project Experience

### 项目名称 / Project Name
**中文**: 在线简历管理系统
**English**: Online Resume Management System

### 项目描述 / Project Description
**中文**: 基于React和Node.js开发的简历管理系统
**English**: Resume management system developed with React and Node.js

### 项目职责 / Project Responsibilities
**中文**: 负责前端开发，实现用户界面和交互功能
**English**: Responsible for frontend development, implementing UI and interaction features

---

## 获奖情况 / Awards & Honors

### 获奖名称 / Award Name
**中文**: 优秀毕业生
**English**: Outstanding Graduate

### 获奖时间 / Award Date
**中文**: 2017年6月
**English**: June 2017

### 获奖级别 / Award Level
**中文**: 校级
**English**: University Level

---

## 紧急联系人 / Emergency Contact

### 联系人姓名 / Contact Name
**中文**: 李四
**English**: Li Si

### 关系 / Relationship
**中文**: 父亲
**English**: Father

### 联系电话 / Contact Phone
**中文**: 13900139000
**English**: 13900139000

---

## 其他信息 / Additional Information

### 是否接受出差 / Willing to Travel
**中文**: 是
**English**: Yes

### 是否接受加班 / Willing to Overtime
**中文**: 是
**English**: Yes

### 入职时间 / Available Start Date
**中文**: 随时
**English**: Anytime

### 备注 / Remarks
**中文**: 无
**English**: None`;

    const blob = new Blob([templateContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '简历模板.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showStatus('模板文件已下载', 'success');
  }

  async handleTxtResumeSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
      this.showStatus('请选择 .txt 格式的简历文件', 'error');
      return;
    }
    try {
      const content = await this.readFile(file);
      if (!txtParser) txtParser = new TxtResumeParser();
      const { result, unknown } = txtParser.parseTxt(content);
      const md = txtParser.toMarkdown(result, unknown);
      this.showTxtMdPreview(md);
    } catch (error) {
      this.showStatus('读取txt简历失败: ' + error.message, 'error');
    }
  }

  showTxtMdPreview(md) {
    document.getElementById('txtMdPreviewContent').textContent = md;
    document.getElementById('txtMdPreviewSection').style.display = 'block';
  }

  copyTxtMdToClipboard() {
    const md = document.getElementById('txtMdPreviewContent').textContent;
    navigator.clipboard.writeText(md).then(() => {
      this.showStatus('已复制到剪贴板', 'success');
    });
  }

  downloadTxtMd() {
    const md = document.getElementById('txtMdPreviewContent').textContent;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '自动生成简历模板.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showStatus('已下载为.md文件', 'success');
  }

  async handleTxtForAiSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
      this.showStatus('请选择 .txt 格式的文本文件', 'error');
      return;
    }
    try {
      const content = await this.readFile(file);
      this.showAiStatus('正在使用AI解析简历内容...', 'info');
      const aiResult = await this.processTxtForAi(content);
      this.showAiResultPreview(aiResult);
      this.showAiStatus('AI解析完成！', 'success');
    } catch (error) {
      this.showAiStatus('AI解析失败: ' + error.message, 'error');
    }
  }

  async processTxtForAi(content) {
    try {
      // 调用本地API进行AI解析
      const response = await fetch('http://localhost:3001/api/parse-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txt: content })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API调用失败');
      }

      const result = await response.json();
      
      // 将AI解析结果转换为markdown格式
      return this.convertAiResultToMarkdown(result);
    } catch (error) {
      console.error('AI解析错误:', error);
      throw new Error('AI解析服务不可用，请确保服务器正在运行');
    }
  }

  convertAiResultToMarkdown(aiResult) {
    let markdown = '# 个人简历模板 / Personal Resume Template\n\n';
    
    // 基本信息
    if (aiResult['基本信息']) {
      markdown += '## 基本信息 / Basic Information\n\n';
      const basicInfo = aiResult['基本信息'];
      if (Array.isArray(basicInfo)) {
        const fields = ['姓名', '性别', '出生日期', '政治面貌', '民族', '身份证号', '手机号码', '邮箱地址', '现居地址', '籍贯'];
        fields.forEach((field, index) => {
          if (basicInfo[index] && basicInfo[index] !== 'null') {
            markdown += `### ${field} / ${field}\n**中文**: ${basicInfo[index]}\n**English**: ${basicInfo[index]}\n\n`;
          }
        });
      }
    }

    // 教育背景
    if (aiResult['教育背景']) {
      markdown += '## 教育背景 / Education Background\n\n';
      const education = aiResult['教育背景'];
      if (Array.isArray(education)) {
        const fields = ['最高学历', '毕业院校', '专业', '毕业时间', '学位', 'GPA', '主修课程', '学习成绩'];
        fields.forEach((field, index) => {
          if (education[index] && education[index] !== 'null') {
            markdown += `### ${field} / ${field}\n**中文**: ${education[index]}\n**English**: ${education[index]}\n\n`;
          }
        });
      }
    }

    // 工作经历
    if (aiResult['工作经历'] && Array.isArray(aiResult['工作经历'])) {
      markdown += '## 工作经历 / Work Experience\n\n';
      aiResult['工作经历'].forEach((work, index) => {
        if (typeof work === 'object') {
          markdown += `### 工作经历 ${index + 1} / Work Experience ${index + 1}\n`;
          Object.entries(work).forEach(([key, value]) => {
            if (value && value !== 'null') {
              markdown += `**${key}**: ${value}\n`;
            }
          });
          markdown += '\n';
        }
      });
    }

    // 实习经历
    if (aiResult['实习经历'] && Array.isArray(aiResult['实习经历'])) {
      markdown += '## 实习经历 / Internship Experience\n\n';
      aiResult['实习经历'].forEach((internship, index) => {
        if (typeof internship === 'object') {
          markdown += `### 实习经历 ${index + 1} / Internship Experience ${index + 1}\n`;
          Object.entries(internship).forEach(([key, value]) => {
            if (value && value !== 'null') {
              markdown += `**${key}**: ${value}\n`;
            }
          });
          markdown += '\n';
        }
      });
    }

    // 项目经历
    if (aiResult['项目经历'] && Array.isArray(aiResult['项目经历'])) {
      markdown += '## 项目经历 / Project Experience\n\n';
      aiResult['项目经历'].forEach((project, index) => {
        if (typeof project === 'object') {
          markdown += `### 项目经历 ${index + 1} / Project Experience ${index + 1}\n`;
          Object.entries(project).forEach(([key, value]) => {
            if (value && value !== 'null') {
              markdown += `**${key}**: ${value}\n`;
            }
          });
          markdown += '\n';
        }
      });
    }

    // 校园经历
    if (aiResult['校园经历'] && Array.isArray(aiResult['校园经历'])) {
      markdown += '## 校园经历 / Campus Experience\n\n';
      aiResult['校园经历'].forEach((campus, index) => {
        if (typeof campus === 'object') {
          markdown += `### 校园经历 ${index + 1} / Campus Experience ${index + 1}\n`;
          Object.entries(campus).forEach(([key, value]) => {
            if (value && value !== 'null') {
              markdown += `**${key}**: ${value}\n`;
            }
          });
          markdown += '\n';
        }
      });
    }

    // 技能特长
    if (aiResult['技能特长']) {
      markdown += '## 技能特长 / Skills & Expertise\n\n';
      const skills = aiResult['技能特长'];
      if (Array.isArray(skills)) {
        skills.forEach((skill, index) => {
          if (skill && skill !== 'null') {
            markdown += `### 技能 ${index + 1} / Skill ${index + 1}\n**中文**: ${skill}\n**English**: ${skill}\n\n`;
          }
        });
      }
    }

    // 证书资质
    if (aiResult['证书资质'] && Array.isArray(aiResult['证书资质'])) {
      markdown += '## 证书资质 / Certifications\n\n';
      aiResult['证书资质'].forEach((cert, index) => {
        if (typeof cert === 'object') {
          markdown += `### 证书 ${index + 1} / Certification ${index + 1}\n`;
          Object.entries(cert).forEach(([key, value]) => {
            if (value && value !== 'null') {
              markdown += `**${key}**: ${value}\n`;
            }
          });
          markdown += '\n';
        }
      });
    }

    // 获奖情况
    if (aiResult['获奖情况'] && Array.isArray(aiResult['获奖情况'])) {
      markdown += '## 获奖情况 / Awards & Honors\n\n';
      aiResult['获奖情况'].forEach((award, index) => {
        if (typeof award === 'object') {
          markdown += `### 获奖 ${index + 1} / Award ${index + 1}\n`;
          Object.entries(award).forEach(([key, value]) => {
            if (value && value !== 'null') {
              markdown += `**${key}**: ${value}\n`;
            }
          });
          markdown += '\n';
        }
      });
    }

    // 自我评价
    if (aiResult['自我评价']) {
      markdown += '## 自我评价 / Self-Evaluation\n\n';
      const selfEval = aiResult['自我评价'];
      if (Array.isArray(selfEval)) {
        selfEval.forEach((evaluation, index) => {
          if (evaluation && evaluation !== 'null') {
            markdown += `### 评价 ${index + 1} / Evaluation ${index + 1}\n**中文**: ${evaluation}\n**English**: ${evaluation}\n\n`;
          }
        });
      }
    }

    // 职业规划
    if (aiResult['职业规划']) {
      markdown += '## 职业规划 / Career Goals\n\n';
      const careerGoals = aiResult['职业规划'];
      if (Array.isArray(careerGoals)) {
        careerGoals.forEach((goal, index) => {
          if (goal && goal !== 'null') {
            markdown += `### 目标 ${index + 1} / Goal ${index + 1}\n**中文**: ${goal}\n**English**: ${goal}\n\n`;
          }
        });
      }
    }

    return markdown;
  }

  showAiResultPreview(aiResult) {
    document.getElementById('aiParsingContent').textContent = aiResult;
    document.getElementById('aiParsingSection').style.display = 'block';
    
    // 自动生成文件名
    this.generateFileName(aiResult);
  }

  generateFileName(aiResult) {
    // 从AI结果中提取姓名和当前日期
    let name = '未知姓名';
    const today = new Date();
    const dateStr = today.getFullYear() + 
                   String(today.getMonth() + 1).padStart(2, '0') + 
                   String(today.getDate()).padStart(2, '0');
    
    // 尝试从AI结果中提取姓名
    if (aiResult.includes('### 姓名')) {
      const nameMatch = aiResult.match(/### 姓名[^\n]*\n\*\*中文\*\*: ([^\n]+)/);
      if (nameMatch) {
        name = nameMatch[1].trim();
      }
    }
    
    const fileName = `${name}_${dateStr}`;
    document.getElementById('aiResultName').value = fileName;
  }

  showAiStatus(message, type) {
    const status = document.getElementById('aiStatus');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    if (type !== 'info') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 5000);
    }
  }

  copyAiResultToClipboard() {
    const aiResult = document.getElementById('aiParsingContent').textContent;
    navigator.clipboard.writeText(aiResult).then(() => {
      this.showStatus('AI解析结果已复制到剪贴板', 'success');
    });
  }

  downloadAiResult() {
    const aiResult = document.getElementById('aiParsingContent').textContent;
    const fileName = document.getElementById('aiResultName').value || 'AI解析简历模板';
    const blob = new Blob([aiResult], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showStatus('AI解析结果已下载为.md文件', 'success');
  }

  async useAiResult() {
    try {
      const aiResult = document.getElementById('aiParsingContent').textContent;
      const resumeData = this.parser.parseMarkdown(aiResult);
      
      if (Object.keys(resumeData).length === 0) {
        this.showStatus('无法解析AI结果，请检查内容格式', 'error');
        return;
      }

      // 保存到存储
      await chrome.storage.local.set({ resumeData: resumeData, currentTemplate: this.currentTemplate });
      
      this.showStatus(`成功使用AI解析结果！共解析 ${Object.keys(resumeData).length} 个字段`, 'success');
      this.updatePreview(resumeData);
      // 自动填充在线编辑表单
      await this.loadCurrentResumeToEditor();
      
      // 隐藏AI解析结果区域
      document.getElementById('aiParsingSection').style.display = 'none';
      
    } catch (error) {
      this.showStatus('使用AI结果失败: ' + error.message, 'error');
    }
  }

  async handleTemplateChange(e) {
    const value = e.target.value;
    this.currentTemplate = value;
    await chrome.storage.local.set({ currentTemplate: value });
    this.showStatus('已切换模板：' + value, 'info');
    // 可选：清空预览/数据，提示用户重新上传对应模板的简历
    document.getElementById('resumePreview').style.display = 'none';
    document.getElementById('txtMdPreviewSection').style.display = 'none';
  }

  async loadTemplateChoice() {
    const result = await chrome.storage.local.get(['currentTemplate']);
    if (result.currentTemplate) {
      this.currentTemplate = result.currentTemplate;
      document.getElementById('templateSelector').value = result.currentTemplate;
    }
  }

  async saveAiResultToLocal() {
    try {
      const aiResult = document.getElementById('aiParsingContent').textContent;
      const fileName = document.getElementById('aiResultName').value;
      
      if (!fileName) {
        this.showStatus('请输入文件名', 'error');
        return;
      }
      
      const blob = new Blob([aiResult], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStatus(`AI解析结果已保存为 ${fileName}.md`, 'success');
    } catch (error) {
      this.showStatus('保存AI解析结果失败: ' + error.message, 'error');
    }
  }
}

// 初始化选项管理器
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
}); 