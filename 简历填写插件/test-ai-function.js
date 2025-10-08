const fs = require('fs');
const axios = require('axios');

async function testAiFunction() {
  try {
    console.log('🧪 开始测试AI解析功能...');
    
    // 读取测试数据
    const testData = fs.readFileSync('./chenhui.txt', 'utf8');
    console.log('📄 读取测试数据完成，长度:', testData.length, '字符');
    
    // 测试服务器连接
    console.log('🔗 测试服务器连接...');
    const response = await axios.post('http://localhost:3001/api/parse-resume', {
      txt: testData
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ AI解析成功！');
    console.log('📊 解析结果字段数:', Object.keys(response.data).length);
    
    // 显示解析结果摘要
    Object.entries(response.data).forEach(([section, data]) => {
      if (Array.isArray(data)) {
        console.log(`📋 ${section}: ${data.length} 项`);
      } else if (typeof data === 'object') {
        console.log(`📋 ${section}: ${Object.keys(data).length} 项`);
      } else {
        console.log(`📋 ${section}: 1 项`);
      }
    });
    
    // 测试文件名生成
    const today = new Date();
    const dateStr = today.getFullYear() + 
                   String(today.getMonth() + 1).padStart(2, '0') + 
                   String(today.getDate()).padStart(2, '0');
    
    // 尝试提取姓名
    let name = '未知姓名';
    if (response.data['基本信息'] && Array.isArray(response.data['基本信息'])) {
      name = response.data['基本信息'][0] || '未知姓名';
    }
    
    const fileName = `${name}_${dateStr}`;
    console.log('📁 生成的文件名:', fileName);
    
    console.log('🎉 所有测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }
  }
}

// 运行测试
testAiFunction(); 