const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

const API_KEY = process.env.DASHSCOPE_API_KEY;

// 定义简历字段结构
const RESUME_FIELDS = {
  '基本信息': ['姓名', '性别', '出生日期', '政治面貌', '民族', '身份证号', '手机号码', '邮箱地址', '现居地址', '籍贯'],
  '教育背景': ['最高学历', '毕业院校', '专业', '毕业时间', '学位', 'GPA', '主修课程', '学习成绩'],
  '工作经历': ['公司名称', '工作时间', '职位名称', '工作内容', '工作业绩'],
  '实习经历': ['实习公司', '实习职位', '实习时间', '实习内容', '实习收获'],
  '项目经历': ['项目名称', '项目时间', '项目描述', '项目职责', '项目成果'],
  '校园经历': ['组织名称', '担任职务', '任职时间', '工作内容', '主要成就'],
  '技能特长': ['专业技能', '语言能力', '计算机技能', '其他技能'],
  '证书资质': ['证书名称', '获得时间', '证书编号', '发证机构'],
  '获奖情况': ['奖项名称', '获奖时间', '获奖级别', '颁发单位'],
  '自我评价': ['性格特点', '能力特长', '个人优势'],
  '职业规划': ['短期目标', '长期目标', '发展方向']
};

app.post('/api/parse-resume', async (req, res) => {
  console.log('收到请求体大小:', JSON.stringify(req.body).length, '字节');
  
  const { txt } = req.body;
  if (!API_KEY) {
    console.error('API Key未设置');
    return res.status(500).json({ error: 'API Key not set' });
  }
  
  // 检查API密钥格式
  if (!API_KEY.startsWith('sk-')) {
    console.error('API密钥格式错误，应该以sk-开头');
    return res.status(500).json({ error: 'Invalid API Key format' });
  }
  
  console.log('API密钥格式检查通过，长度:', API_KEY.length);
  
  if (!txt) {
    console.error('未提供简历文本');
    return res.status(400).json({ error: 'No txt provided' });
  }

  console.log('简历文本长度:', txt.length, '字符');
  console.log('简历文本前100字符:', txt.substring(0, 100));

  try {
    console.log('正在调用DashScope API (OpenAI兼容模式)...');
    const requestBody = {
      model: 'qwen-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的简历解析助手，请严格按照指定的JSON格式输出简历信息。'
        },
        {
          role: 'user',
          content: `请将以下简历内容解析为结构化的JSON格式。要求：
1. 严格按照以下字段结构输出，未提及的字段填写null：
${JSON.stringify(RESUME_FIELDS, null, 2)}

2. 解析规则：
- 准确识别文本中明确提到的信息
- 不要推测或填充未明确提到的信息
- 保持原文的表述，不要改写或总结
- 对于列表项，保持原文的序号或符号
- 处理中英文混排的情况，分别存储中英文内容

3. 输出要求：
- 必须是合法的JSON格式
- 使用UTF-8编码
- 保持原文的换行格式
- 对特殊字符进行转义

简历内容如下：
${txt}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4000
    };
    
    console.log('请求体大小:', JSON.stringify(requestBody).length, '字节');
    
    const dashscopeRes = await axios.post(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    console.log('API响应状态:', dashscopeRes.status);
    console.log('API响应头:', dashscopeRes.headers);
    
    // 解析返回的JSON
    let aiResponse = dashscopeRes.data.choices[0].message.content;
    console.log('AI响应文本完整内容:', aiResponse);

    // 检查并提取纯净的JSON字符串
    if (aiResponse.includes('```json')) {
      const match = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        aiResponse = match[1];
        console.log('已提取Markdown中的JSON内容');
      }
    } else if (aiResponse.startsWith('`') && aiResponse.endsWith('`')) {
        aiResponse = aiResponse.substring(1, aiResponse.length - 1);
    }
    
    let parsedResume;
    try {
      parsedResume = JSON.parse(aiResponse);
    } catch (e) {
      console.error('JSON解析错误:', e);
      console.error('尝试解析的文本:', aiResponse);
      return res.status(500).json({ 
        error: 'API返回的内容不是有效的JSON格式',
        rawResponse: aiResponse
      });
    }

    res.json(parsedResume);
  } catch (err) {
    console.error('API调用错误:', err.message);
    console.error('错误详情:', err.response?.data);
    res.status(500).json({ 
      error: err.message, 
      detail: err.response?.data,
      rawResponse: err.response?.data?.choices?.[0]?.message?.content 
    });
  }
});

const port = 3001;
app.listen(port, () => {
  console.log(`DashScope proxy running on http://localhost:${port}`);
  if (!API_KEY) {
    console.warn('警告: DASHSCOPE_API_KEY 环境变量未设置');
  } else {
    console.log('API密钥已设置，长度:', API_KEY.length);
    console.log('API密钥格式:', API_KEY.startsWith('sk-') ? '正确' : '错误');
  }
}); 