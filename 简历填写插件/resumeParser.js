class ResumeParser {
  constructor() {
    this.resumeData = {};
    this.fieldMappings = {
      // Basic Info（仅中文/拼音常见别名，移除英文映射）
      '姓名': ['姓名', '名字', 'xingming'],
      '性别': ['性别', '男', '女'],
      '出生日期': ['出生日期', '出生', '生日', 'shengri'],
      '政治面貌': ['政治面貌', '政治身份'],
      '民族': ['民族', 'minzu'],
      '身份证号': ['身份证号', '身份证号码', '身份证', '证件号', '证件号码', '第二代身份证', 'shenfenzheng', 'shenfenzhenghao', 'sfz'],
      '手机号码': ['手机号码', '手机', '电话', '联系电话', 'shouji', 'dianhua', 'tel'],
      '邮箱地址': ['邮箱地址', '电子邮件', '邮箱', 'youxiang', 'email'],
      '现居地址': ['现居地址', '当前地址', '居住地址', '现住址', '常住地址', '联系地址', '通讯地址', '家庭住址', '家庭地址', '住址', '详细地址', '所在地址', '地址'],
      '籍贯': ['籍贯', '籍贯地'],
      '所在城市': ['所在城市', '城市'],
      // Extra Basic Info from template
      '身高': ['身高', 'shengao', 'height'],
      '体重': ['体重', 'tizhong', 'weight'],
      '国籍': ['国籍', '国家', 'guoji'],
      '家庭住址': ['家庭住址', '家庭地址', '住址'],
      '出生地': ['出生地', '出生地点', '籍贯地', 'birthplace'],
      '户口所在地': ['户口所在地', '户口', '户籍', 'hukou'],
      // Education
      '教育背景': ['教育背景', '教育经历'],
      '最高学历': ['最高学历', '学历层次', '学历'],
      '毕业院校': ['毕业院校', '学校名称', '学校', '院校'],
      '专业': ['专业', '专业名称'],
      '毕业时间': ['毕业时间', '结束日期', '毕业年份', '结束时间'],
      '学位': ['学位'],
      'GPA': ['GPA', '绩点'],
      '第一学历': ['第一学历'],
      '本科毕业院校': ['本科毕业院校'],
      '本科专业': ['本科专业'],
      '本科毕业时间': ['本科毕业时间'],
      '本科学位': ['本科学位'],
      '本科GPA': ['本科GPA'],
      // Work
      '工作经历': ['工作经历', '工作经验'],
      '工作年限': ['工作年限', '工作年数'],
      '期望职位': ['期望职位'],
      '期望工作地点': ['期望工作地点', '期望城市', '期望地点'],
      '期望薪资': ['期望薪资', '薪资期望'],
      // Skills & Personal
      '专业技能': ['专业技能', '技能'],
      '语言能力': ['语言能力', '语言'],
      '计算机技能': ['计算机技能', '计算机'],
      '证书资质': ['证书资质', '证书'],
      '兴趣爱好': ['兴趣爱好', '爱好'],
      '性格特点': ['性格特点'],
      '自我评价': ['自我评价', '自我描述'],
      '职业规划': ['职业规划'],
      // Experiences
      '项目经历': ['项目经历'],
      '实习经历': ['实习经历'],
      '校园经历': ['校园经历'],
      '获奖情况': ['获奖情况'],
    };
    this.multiEntrySections = ['项目经历', '校园经历', '获奖情况'];

    // 反向映射
    this.keywordToField = {};
    for (const [std, arr] of Object.entries(this.fieldMappings)) {
      arr.forEach(k => this.keywordToField[k.toLowerCase()] = std);
    }
  }

  parseMarkdown(content) {
    console.log('%c--- DEBUG: [ResumeParser] Starting parseMarkdown ---', 'color: blue; font-weight: bold;');
    this.resumeData = {};
    if (!content) return this.resumeData;

    // FIX: Split by actual newline character \n, not the string '\\n'
    const lines = content.replace(/\r/g, '').split('\n');
    
    let currentSectionTitle = '';
    let currentEntry = null;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('## ')) {
            currentSectionTitle = trimmedLine.replace(/^##\s*/, '').split(' / ')[0].trim();
            console.log(`%c--- DEBUG: [ResumeParser] Found Section: ${currentSectionTitle}`, 'color: green;');
            
            if (this.multiEntrySections.includes(currentSectionTitle)) {
                this.resumeData[currentSectionTitle] = [];
                currentEntry = {}; // Start the first entry immediately
                this.resumeData[currentSectionTitle].push(currentEntry);
            } else {
                this.resumeData[currentSectionTitle] = {};
                currentEntry = this.resumeData[currentSectionTitle];
            }
            i++;
        } else if (trimmedLine.startsWith('---')) {
            console.log('%c--- DEBUG: [ResumeParser] Found Separator "---"', 'color: gray;');
            if (currentSectionTitle && this.multiEntrySections.includes(currentSectionTitle)) {
                currentEntry = {}; // Create a new entry for the multi-entry section
                this.resumeData[currentSectionTitle].push(currentEntry);
            }
            i++;
        } else if (trimmedLine.startsWith('### ')) {
            if (!currentEntry) {
                i++;
                continue; // Skip fields that are not under a section
            }

            const currentField = trimmedLine.replace(/^###\s*/, '').split(' / ')[0].trim();
            console.log(`%c--- DEBUG: [ResumeParser] Found Field: ${currentField}`, 'color: purple;');
            
            let contentLines = [];
            let j = i + 1;
            while (j < lines.length) {
                const nextLineTrimmed = lines[j].trim();
                if (nextLineTrimmed.startsWith('## ') || nextLineTrimmed.startsWith('### ') || nextLineTrimmed.startsWith('---')) {
                    break;
                }
                contentLines.push(lines[j]);
                j++;
            }

            const contentBlock = contentLines.join('\n');
            const parsedContent = this.parseFieldContent(contentBlock);
            if (parsedContent.cn) currentEntry[currentField] = parsedContent.cn;
             
            i = j; // Move the main loop index to the next unprocessed line
        } else {
            i++; // Move to the next line if it's not a marker
        }
    }
    console.log('%c--- DEBUG: [ResumeParser] Final resumeData before returning ---', 'color: blue; font-weight: bold;');
    console.log(JSON.stringify(this.resumeData, null, 2));
    return this.resumeData;
  }
  
  parseFieldContent(content) {
    // 移除英文分段，仅保留整体中文文本，并去掉前缀“**中文**:”或“中文:”
    const englishSection = content.match(/\*\*English\*\*:\s*[\s\S]*/);
    let cnOnly = content;
    if (englishSection) {
      cnOnly = content.replace(englishSection[0], '').trim();
    }
    // 去掉可能存在的中文标记前缀
    cnOnly = cnOnly.replace(/^\*\*中文\*\*:\s*/, '').replace(/^中文:\s*/, '').trim();
    return { cn: cnOnly, en: '' };
  }

  findMatchingField(formField) {
    const formFieldLower = formField.toLowerCase();

    for (const sectionTitle of this.multiEntrySections) {
      const keywords = this.fieldMappings[sectionTitle] || [sectionTitle];
      if (keywords.some(kw => formFieldLower.includes(kw.toLowerCase()))) {
        const entries = this.resumeData[sectionTitle] || [];
        if (entries.length > 0) {
          // FIX: Use real newlines \n instead of string '\\n'
          const combined = entries.map(entry => {
            return Object.entries(entry)
              .filter(([key, value]) => !key.endsWith('_en') && value)
              .map(([key, value]) => `${key.split(' / ')[0]}:\n${value}`)
              .join('\n\n');
          }).join('\n\n---\n\n');
          if (combined) return combined;
        }
      }
    }

    for (const [fieldName, keywords] of Object.entries(this.fieldMappings)) {
        if(keywords.some(kw => formFieldLower.includes(kw.toLowerCase()))) {
            for(const sectionTitle in this.resumeData) {
                if(!this.multiEntrySections.includes(sectionTitle)) {
                    const sectionData = this.resumeData[sectionTitle];
                    if(sectionData && sectionData[fieldName]) {
                        return sectionData[fieldName];
                    }
                }
            }
            for(const sectionTitle of this.multiEntrySections) {
                const entries = this.resumeData[sectionTitle] || [];
                if(entries.length > 0 && entries[0] && entries[0][fieldName]) {
                    return entries[0][fieldName];
                }
            }
        }
    }

    return null;
  }

  // 模糊查找字段名
  findMatchingFieldFuzzy(identifiers) {
    if (!identifiers) return '';
    const idArr = identifiers.split(' ');
    // 先精确查找
    for (const id of idArr) {
      const stdKey = this.keywordToField[id.trim().toLowerCase()];
      if (stdKey) {
        const v = this.getValueByField(stdKey);
        if (v) return v;
      }
    }
    // 再模糊查找
    for (const id of idArr) {
      for (const [kw, stdKey] of Object.entries(this.keywordToField)) {
        if (id.includes(kw)) {
          const v = this.getValueByField(stdKey);
          if (v) return v;
        }
      }
    }
    // 宽松查找：不直接返回分区对象，尝试在所有分区内匹配字段名子串
    for (const sectionKey of Object.keys(this.resumeData || {})) {
      const sectionVal = this.resumeData[sectionKey];
      if (sectionVal && typeof sectionVal === 'object') {
        const pool = Array.isArray(sectionVal) ? sectionVal : [sectionVal];
        for (const entry of pool) {
          if (!entry || typeof entry !== 'object') continue;
          for (const fieldKey of Object.keys(entry)) {
            for (const id of idArr) {
              if (fieldKey.includes(id) || id.includes(fieldKey)) {
                if (entry[fieldKey]) return entry[fieldKey];
              }
            }
          }
        }
      }
    }
    return '';
  }

  // 返回匹配到的标准字段键名（用于从resumeData中安全取值）
  findMatchingKeyFuzzy(identifiers) {
    if (!identifiers) return '';
    const idArr = identifiers.split(' ');
    for (const id of idArr) {
      const stdKey = this.keywordToField[id.trim().toLowerCase()];
      if (stdKey) return stdKey;
    }
    for (const id of idArr) {
      for (const [kw, stdKey] of Object.entries(this.keywordToField)) {
        if (id.includes(kw)) return stdKey;
      }
    }
    // 不返回分区名称，防止把整个分区对象当成字段值
    return '';
  }

  // 根据标准字段键名，跨分区返回字段值
  getValueByField(stdFieldKey) {
    if (!stdFieldKey) return '';
    const data = this.resumeData || {};
    for (const [sectionKey, sectionVal] of Object.entries(data)) {
      if (!sectionVal) continue;
      if (Array.isArray(sectionVal)) {
        for (const entry of sectionVal) {
          if (entry && typeof entry === 'object' && entry[stdFieldKey]) {
            return entry[stdFieldKey];
          }
        }
      } else if (typeof sectionVal === 'object') {
        if (sectionVal[stdFieldKey]) return sectionVal[stdFieldKey];
      }
    }
    return '';
  }

  // 获取所有可用的字段
  getAvailableFields() {
    return Object.keys(this.resumeData);
  }

  // 清空数据
  clear() {
    this.resumeData = {};
  }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResumeParser;
}
