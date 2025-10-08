class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.updateStatus();
    this.bindEvents();
    
    // 定期更新状态
    setInterval(() => {
      this.updateStatus();
    }, 5000);
  }

  bindEvents() {
    // 立即填写按钮
    document.getElementById('fillNow').addEventListener('click', () => {
      this.fillNow();
    });

    // 刷新统计按钮
    document.getElementById('refreshStats').addEventListener('click', () => {
      this.updateStatus();
    });

    // 打开设置按钮
    document.getElementById('openOptions').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 自动填写开关
    document.getElementById('autoFillToggle').addEventListener('change', (e) => {
      this.updateSetting('autoFill', e.target.checked);
    });

    // 通知开关
    document.getElementById('notificationToggle').addEventListener('change', (e) => {
      this.updateSetting('showNotification', e.target.checked);
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['autoFill', 'showNotification']);
      document.getElementById('autoFillToggle').checked = result.autoFill !== false;
      document.getElementById('notificationToggle').checked = result.showNotification !== false;
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  async updateSetting(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      console.log(`设置已更新: ${key} = ${value}`);
    } catch (error) {
      console.error('更新设置失败:', error);
    }
  }

  async updateStatus() {
    try {
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        this.updateStatusContent('无法获取当前标签页信息');
        return;
      }

      // 检查是否有简历数据
      const resumeResult = await chrome.storage.local.get(['resumeData']);
      const hasResumeData = resumeResult.resumeData && Object.keys(resumeResult.resumeData).length > 0;

      if (!hasResumeData) {
        this.updateStatusContent('⚠️ 未检测到简历数据\n请先上传简历文件');
        document.getElementById('statsContainer').style.display = 'none';
        return;
      }

      // 向content script发送消息获取表单统计
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getFormStats' });
        
        if (response && response.success) {
          const stats = response.data;
          this.updateStats(stats);
          this.updateStatusContent(`✅ 简历数据已加载\n当前页面: ${stats.total} 个表单字段`);
        } else {
          this.updateStatusContent('✅ 简历数据已加载\n当前页面无表单字段');
          document.getElementById('statsContainer').style.display = 'none';
        }
      } catch (error) {
        // content script可能未加载
        this.updateStatusContent('✅ 简历数据已加载\n请刷新页面以检测表单');
        document.getElementById('statsContainer').style.display = 'none';
      }

    } catch (error) {
      this.updateStatusContent('❌ 状态更新失败\n' + error.message);
      document.getElementById('statsContainer').style.display = 'none';
    }
  }

  updateStatusContent(message) {
    const statusContent = document.getElementById('statusContent');
    statusContent.innerHTML = message.replace(/\n/g, '<br>');
  }

  updateStats(stats) {
    document.getElementById('totalFields').textContent = stats.total;
    document.getElementById('filledFields').textContent = stats.filled;
    document.getElementById('emptyFields').textContent = stats.empty;
    document.getElementById('statsContainer').style.display = 'grid';
  }

  async fillNow() {
    // 获取当前tab信息
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      this.showMessage('无法获取当前标签页', 'error');
      return;
    }
    // 弹出确认框
    const confirmMsg = `是否在当前页面自动填写？\n\n页面标题：${tab.title}\n页面地址：${tab.url}`;
    if (!window.confirm(confirmMsg)) {
      this.showMessage('已取消自动填写', 'info');
      return;
    }
    this.showMessage('正在尝试填写...', 'loading');
    try {
      // 检查是否有简历数据
      const resumeResult = await chrome.storage.local.get(['resumeData']);
      if (!resumeResult.resumeData || Object.keys(resumeResult.resumeData).length === 0) {
        this.showMessage('请先在设置页上传简历', 'error');
        return;
      }

      // 确保内容脚本已注入
      const injected = await this.ensureContentScriptInjected(tab.id);
      if (!injected) {
        this.showMessage('无法在该页面注入脚本，可能受网站安全策略限制', 'error');
        return;
      }

      // 发送填写命令
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'fillForm' });
      if (response && response.status === 'ok') {
        this.showMessage(`填写成功！共填写 ${response.filledCount} 个字段`, 'success');
        setTimeout(() => {
          this.updateStatus();
        }, 1000);
      } else {
        throw new Error(response && response.message ? response.message : 'content script返回错误或未注入');
      }
    } catch (error) {
      console.error('填写失败:', error);
      this.showMessage(`填写失败: ${error.message}`, 'error');
    }
  }

  async ensureContentScriptInjected(tabId) {
    // 尝试ping现有内容脚本
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (pong && pong.ok) return true;
    } catch (e) {
      // 忽略，说明未注入
    }
    // 动态注入内容脚本
    try {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['resumeParser.js'] });
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
      // 再次ping确认
      const pong = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return !!(pong && pong.ok);
    } catch (e) {
      console.error('动态注入内容脚本失败:', e);
      return false;
    }
  }

  showMessage(message, type = 'info') {
    // 移除已有的消息
    const existingMessage = document.getElementById('popup-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    const messageDiv = document.createElement('div');
    messageDiv.id = 'popup-message';
    let backgroundColor = '#333';
    switch (type) {
      case 'success': backgroundColor = '#28a745'; break;
      case 'error': backgroundColor = '#dc3545'; break;
      case 'loading': backgroundColor = '#007bff'; break;
    }
    messageDiv.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${backgroundColor};
      color: white;
      padding: 8px 15px;
      border-radius: 5px;
      font-size: 12px;
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    if (type !== 'loading') {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 3000);
    }
  }

  // 获取插件信息
  async getPluginInfo() {
    const manifest = chrome.runtime.getManifest();
    return {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description
    };
  }
}

// 初始化弹出窗口管理器
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updatePopup') {
    // 更新弹出窗口状态
    window.location.reload();
  }
}); 