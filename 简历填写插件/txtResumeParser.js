class TxtResumeParser {
  constructor() {
    // 字段映射与分段标题
    this.sectionMap = {
      '基本信息': ['基本信息', 'Personal Info', '个人信息', '联系方式', 'Contact'],
      '教育背景': ['教育背景', 'Education', '教育经历', '学历'],
      '工作经历': ['工作经历', 'Work Experience', '工作经验', '职业经历'],
      '实习经历': ['实习经历', 'Internship', '实习经验'],
      '项目经历': ['项目经历', 'Project Experience', '项目', '项目经验'],
      '校园经历': ['校园经历', 'Campus Experience', '学生工作', '社团经历'],
      '技能特长': ['技能', '技能特长', 'Skills', '专长', '能力'],
      '证书资质': ['证书', '证书资质', 'Certifications', '资格证书'],
      '获奖情况': ['获奖', '获奖情况', 'Awards', '荣誉'],
      '兴趣爱好': ['兴趣', '兴趣爱好', 'Hobbies'],
      '自我评价': ['自我评价', '自我描述', 'Self-Evaluation', '自我介绍'],
      '职业规划': ['职业规划', 'Career Goals', '目标'],
      '其他信息': ['其他信息', 'Additional Information', '备注', 'Others']
    };
    // 关键词到模板字段
    this.fieldMap = {
      '姓名': ['姓名', '名字', 'Name'],
      '性别': ['性别', 'Gender'],
      '出生日期': ['出生日期', '生日', 'Date of Birth', 'Birthday'],
      '政治面貌': ['政治面貌', '政治身份', 'Political Status'],
      '民族': ['民族', 'Ethnicity'],
      '身份证号': ['身份证号', '身份证', 'ID Number'],
      '手机号码': ['手机', '手机号码', '电话', '联系电话', 'Phone', 'Mobile'],
      '邮箱地址': ['邮箱', '电子邮件', 'Email'],
      '现居地址': ['现居地址', '住址', '地址', 'Current Address', 'Address'],
      '籍贯': ['籍贯', '籍贯地', 'Place of Origin'],
      '最高学历': ['学历', '最高学历', 'Education'],
      '毕业院校': ['毕业院校', '学校', 'University', 'School'],
      '专业': ['专业', 'Major'],
      '毕业时间': ['毕业时间', '毕业年份', 'Graduation Date'],
      '学位': ['学位', 'Degree'],
      'GPA': ['GPA'],
      '当前职位': ['当前职位', '职位', 'Position', 'Current Position'],
      '工作年限': ['工作年限', '工作经验', 'Years of Experience'],
      '期望薪资': ['期望薪资', '薪资', 'Expected Salary'],
      '期望工作地点': ['期望工作地点', '工作地点', 'Preferred Location'],
      '期望职位': ['期望职位', 'Expected Position'],
      '专业技能': ['专业技能', '技能', 'Skills'],
      '语言能力': ['语言能力', '语言', 'Language Skills'],
      '计算机技能': ['计算机技能', '计算机', 'Computer Skills'],
      '证书资质': ['证书资质', '证书', 'Certifications'],
      '兴趣爱好': ['兴趣爱好', '爱好', 'Hobbies'],
      '性格特点': ['性格特点', '性格', 'Personality Traits'],
      '自我评价': ['自我评价', '自我描述', 'Self-Evaluation'],
      '职业规划': ['职业规划', 'Career Goals'],
      '项目名称': ['项目名称', '项目', 'Project Name'],
      '项目描述': ['项目描述', 'Project Description'],
      '项目职责': ['项目职责', 'Project Responsibilities'],
      '项目成果': ['项目成果', 'Project Achievements'],
      '实习公司': ['实习公司', '实习单位', 'Internship Company'],
      '实习职位': ['实习职位', '实习岗位', 'Internship Position'],
      '实习时间': ['实习时间', '实习期间', 'Internship Period'],
      '实习内容': ['实习内容', 'Internship Content'],
      '实习收获': ['实习收获', 'Internship Gains'],
      '获奖名称': ['获奖名称', '奖项', 'Award Name'],
      '获奖时间': ['获奖时间', 'Award Date'],
      '获奖级别': ['获奖级别', 'Award Level'],
      '联系人姓名': ['联系人姓名', '紧急联系人', 'Contact Name'],
      '关系': ['关系', 'Relationship'],
      '联系电话': ['联系电话', 'Contact Phone'],
      '是否接受出差': ['是否接受出差', '出差', 'Willing to Travel'],
      '是否接受加班': ['是否接受加班', '加班', 'Willing to Overtime'],
      '入职时间': ['入职时间', '到岗时间', 'Available Start Date'],
      '备注': ['备注', '其他', 'Remarks']
    };
    // 反向映射
    this.keywordToField = {};
    for (const [std, arr] of Object.entries(this.fieldMap)) {
      arr.forEach(k => this.keywordToField[k] = std);
    }
  }

  // 智能分段与归类
  splitSections(txt) {
    const lines = txt.split(/\r?\n/);
    let sections = [];
    let current = { title: '其他信息', content: [] };
    for (let line of lines) {
      let found = false;
      for (const [std, arr] of Object.entries(this.sectionMap)) {
        for (const key of arr) {
          if (line.replace(/[【#\s\[\]\/]/g, '').startsWith(key)) {
            if (current.content.length) sections.push(current);
            current = { title: std, content: [] };
            found = true;
            break;
          }
        }
        if (found) break;
      }
      current.content.push(line);
    }
    if (current.content.length) sections.push(current);
    return sections;
  }

  // 智能字段提取（支持多种写法、自然语言、列表、表格）
  extractFields(section) {
    const result = {};
    for (let line of section.content) {
      // 1. 字段:值 或 字段：值
      let match = line.match(/^([\u4e00-\u9fa5A-Za-z\s]+)[：:：]\s*(.+)$/);
      if (match) {
        let key = match[1].trim();
        let value = match[2].trim();
        let stdKey = this.keywordToField[key] || key;
        if (!result[stdKey]) result[stdKey] = value;
        else result[stdKey] += '；' + value;
        continue;
      }
      // 2. 邮箱/电话/身份证/日期/数字等直接识别
      if (/([\w\.-]+@[\w\.-]+)/.test(line)) {
        result['邮箱地址'] = RegExp.$1;
        continue;
      }
      if (/(1[3-9]\d{9})/.test(line)) {
        result['手机号码'] = RegExp.$1;
        continue;
      }
      if (/([1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])([0-2][1-9]|10|20|30|31)\d{3}[0-9Xx])/.test(line)) {
        result['身份证号'] = RegExp.$1;
        continue;
      }
      // 3. 英文名
      if (/Name\s*[:：]?\s*([A-Za-z\s]+)$/.test(line)) {
        result['姓名_en'] = RegExp.$1.trim();
        continue;
      }
      // 4. 纯数字/日期/证书编号
      if (/\d{8,}/.test(line) && line.length < 30) {
        if (!result['证书编号']) result['证书编号'] = line.trim();
        else result['证书编号'] += '；' + line.trim();
        continue;
      }
      // 5. 课程/成绩/技能/证书/获奖/项目等批量提取
      if (/课程|成绩|技能|证书|奖|项目|实习|经历|经验|Internship|Project|Award|Skill|Certificate/i.test(line)) {
        if (!result['相关内容']) result['相关内容'] = line.trim();
        else result['相关内容'] += '\n' + line.trim();
        continue;
      }
      // 6. 列表项
      if (/^[-*•·\d]+[\.、\s]/.test(line)) {
        if (!result['列表']) result['列表'] = line.trim();
        else result['列表'] += '\n' + line.trim();
        continue;
      }
      // 7. 其他自然语言内容
      if (line.length > 8) {
        if (!result['描述']) result['描述'] = line.trim();
        else result['描述'] += '\n' + line.trim();
      }
    }
    return result;
  }

  // 主解析流程
  parseTxt(txt) {
    const sections = this.splitSections(txt);
    const parsed = {};
    let unknown = [];
    for (const section of sections) {
      const fields = this.extractFields(section);
      for (const [k, v] of Object.entries(fields)) {
        // 优先归入模板字段
        if (k in parsed) parsed[k] += '\n' + v;
        else parsed[k] = v;
      }
    }
    // 归入备注
    if (parsed['描述']) {
      unknown.push(parsed['描述']);
      delete parsed['描述'];
    }
    if (parsed['相关内容']) {
      unknown.push(parsed['相关内容']);
      delete parsed['相关内容'];
    }
    if (parsed['列表']) {
      unknown.push(parsed['列表']);
      delete parsed['列表'];
    }
    return { result: parsed, unknown };
  }

  // 生成标准md内容
  toMarkdown(parsed, unknown) {
    // 先用模板字段，后加自定义和unknown
    let md = '# 个人简历模板 / Personal Resume Template\n\n';
    const used = new Set();
    // 基本信息
    md += '## 基本信息 / Basic Information\n';
    [
      '姓名','性别','出生日期','政治面貌','民族','身份证号','手机号码','邮箱地址','现居地址','籍贯'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 教育背景
    md += '\n---\n\n## 教育背景 / Education Background\n';
    [
      '最高学历','毕业院校','专业','毕业时间','学位','GPA'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 工作经历
    md += '\n---\n\n## 工作经历 / Work Experience\n';
    [
      '当前职位','工作年限','期望薪资','期望工作地点','期望职位'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 技能特长
    md += '\n---\n\n## 技能特长 / Skills & Expertise\n';
    [
      '专业技能','语言能力','计算机技能','证书资质'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 个人特质
    md += '\n---\n\n## 个人特质 / Personal Characteristics\n';
    [
      '兴趣爱好','性格特点','自我评价','职业规划'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 项目经历
    md += '\n---\n\n## 项目经历 / Project Experience\n';
    [
      '项目名称','项目描述','项目职责','项目成果'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 实习经历
    md += '\n---\n\n## 实习经历 / Internship Experience\n';
    [
      '实习公司','实习职位','实习时间','实习内容','实习收获'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 获奖情况
    md += '\n---\n\n## 获奖情况 / Awards & Honors\n';
    [
      '获奖名称','获奖时间','获奖级别'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 紧急联系人
    md += '\n---\n\n## 紧急联系人 / Emergency Contact\n';
    [
      '联系人姓名','关系','联系电话'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 其他信息
    md += '\n---\n\n## 其他信息 / Additional Information\n';
    [
      '是否接受出差','是否接受加班','入职时间','备注'
    ].forEach(f => {
      md += `\n### ${f} / ${this.fieldMap[f]?.[1]||f}\n**中文**: ${parsed[f]||''}\n**English**: ${parsed[f+'_en']||''}`;
      used.add(f);
    });
    // 处理自定义字段
    Object.keys(parsed).forEach(f => {
      if (!used.has(f)) {
        md += `\n### ${f} / \n**中文**: ${parsed[f]}\n**English**: `;
      }
    });
    // 未知内容归入备注
    if (unknown && unknown.length > 0) {
      md += `\n### 备注 / Remarks\n**中文**: ${unknown.join('；')}\n**English**: `;
    }
    return md;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TxtResumeParser;
} 