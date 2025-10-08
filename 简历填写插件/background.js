// 后台脚本 - 处理插件的后台逻辑

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装时的初始化
    console.log('自动填简历插件已安装');
    
    // 设置默认配置
    chrome.storage.local.set({
      autoFill: true,
      showNotification: true,
      resumeData: {}
    });
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  switch (message.action) {
    case 'getResumeData':
      // 获取简历数据
      chrome.storage.local.get(['resumeData'], (result) => {
        sendResponse({ success: true, data: result.resumeData || {} });
      });
      return true; // 保持消息通道开放
      
    case 'getSettings':
      // 获取设置
      chrome.storage.local.get(['autoFill', 'showNotification'], (result) => {
        sendResponse({
          success: true,
          settings: {
            autoFill: result.autoFill !== false,
            showNotification: result.showNotification !== false
          }
        });
      });
      return true;
      
    case 'updateSettings':
      // 更新设置
      chrome.storage.local.set({
        autoFill: message.settings.autoFill,
        showNotification: message.settings.showNotification
      }, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'testFill':
      // 测试填写 - 向当前标签页发送消息
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'testFill' });
        }
      });
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: '未知操作' });
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 页面加载完成后，检查是否需要自动填写
    chrome.storage.local.get(['autoFill'], (result) => {
      if (result.autoFill !== false) {
        // 延迟执行，确保页面完全加载
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'autoFill' });
        }, 1000);
      }
    });
  }
});

// 右键菜单功能
chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'fillResume',
    title: '自动填写简历信息',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'fillSpecific',
    title: '填写指定字段',
    contexts: ['page']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fillResume') {
    chrome.tabs.sendMessage(tab.id, { action: 'fillAllForms' });
  } else if (info.menuItemId === 'fillSpecific') {
    // 可以扩展为填写特定字段
    chrome.tabs.sendMessage(tab.id, { action: 'showFieldSelector' });
  }
});

// 处理快捷键
chrome.commands.onCommand.addListener((command) => {
  if (command === 'fill-resume') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'fillAllForms' });
      }
    });
  }
});

// 错误处理
chrome.runtime.onSuspend.addListener(() => {
  console.log('插件即将卸载');
});

// 提供API给其他脚本使用
window.resumePluginAPI = {
  // 获取简历数据
  async getResumeData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resumeData'], (result) => {
        resolve(result.resumeData || {});
      });
    });
  },
  
  // 获取设置
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['autoFill', 'showNotification'], (result) => {
        resolve({
          autoFill: result.autoFill !== false,
          showNotification: result.showNotification !== false
        });
      });
    });
  },
  
  // 更新设置
  async updateSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, () => {
        resolve(true);
      });
    });
  },
  
  // 向当前标签页发送消息
  async sendMessageToCurrentTab(message) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      return chrome.tabs.sendMessage(tabs[0].id, message);
    }
  }
}; 