import re
import os
try:
    from pypinyin import lazy_pinyin
except ImportError:
    lazy_pinyin = None

# 新增：切换到指定目录
os.chdir(r'........')

def extract_citations(text):
    # 匹配所有括号内的内容
    bracket_pattern = r'（([^）]+)）'
    bracket_matches = re.finditer(bracket_pattern, text)
    citations = []
    for bmatch in bracket_matches:
        group = bmatch.group(1)
        # 按分号分割为多条文献
        refs = [ref.strip() for ref in group.split('；') if ref.strip()]
        for ref in refs:
            # 匹配"作者1和作者2，年份"或"作者，年份"，支持and/et al.
            m = re.match(r'([^，；]+)，(\d{4})', ref)
            if m:
                author_field = m.group(1).strip()
                year = int(m.group(2))
                # 拆分作者：支持"和" "and" "et al."
                author_field = author_field.replace('et al.', 'et al').replace('Et al.', 'et al')
                author_field = author_field.replace('和', '|').replace('and', '|').replace('、', '|')
                authors = [a.strip() for a in author_field.split('|') if a.strip()]
                # 处理et al.结尾
                final_authors = []
                for a in authors:
                    if 'et al' in a:
                        final_authors.append(a.split('et al')[0].strip())
                    else:
                        final_authors.append(a)
                citations.append((final_authors, year))
    return citations

def normalize_author(author):
    author = author.strip()
    # 如果以"等"结尾，只取前面的内容
    if author.endswith('等'):
        author = author[:-1]
    # 如果以et al结尾，只取前面的内容
    if 'et al' in author:
        author = author.split('et al')[0].strip()
    # 去除空格、全角/半角逗号、句号
    return re.sub(r'[\s,，.。]', '', author)

def sort_key(ref):
    first_char = ref[0]
    if re.match(r'[A-Za-z]', first_char):
        return (0, first_char.upper(), ref)
    elif '\u4e00' <= first_char <= '\u9fff' and lazy_pinyin:
        py = lazy_pinyin(first_char)[0]
        return (1, py, ref)
    else:
        return (2, first_char, ref)

def find_references(citations, reference_file):
    found_refs = []
    not_found_refs = []
    with open(reference_file, 'r', encoding='utf-8') as f:
        ref_lines = f.readlines()
    for citation in citations:
        authors, year = citation
        # 跳过异常长的作者字段或作者数量过多的情况
        if any(len(a) > 30 for a in authors) or len(authors) > 3:
            not_found_refs.append(f"未找到引用: {authors}, {year}")
            continue
        found = False
        norm_authors = [normalize_author(a) for a in authors if a]
        # 优先用作者名字查找
        for a in norm_authors:
            for line in ref_lines:
                norm_line = re.sub(r'[\s,，.。]', '', line)
                if a and a in norm_line:
                    found_refs.append(line.strip())
                    found = True
                    break
            if found:
                break
        # 如果作者没找到，再用年份+作者兜底
        if not found:
            for line in ref_lines:
                norm_line = re.sub(r'[\s,，.。]', '', line)
                if str(year) in line and any(a in norm_line for a in norm_authors):
                    found_refs.append(line.strip())
                    found = True
                    break
        if not found:
            not_found_refs.append(f"未找到引用: {authors}, {year}")
    # 排序已找到的引用
    found_refs = list(dict.fromkeys(found_refs))  # 去重
    found_refs_sorted = sorted(found_refs, key=sort_key)
    return found_refs_sorted, not_found_refs

def clean_ref_for_output(ref):
    # 去掉文献中多余的[数字]编号
    ref = re.sub(r'(\[\d+\]\s*)+', '', ref).strip()
    # 去掉DOI及其后内容
    ref = re.sub(r'DOI:.*', '', ref).strip()
    # 如果是中文文献，去除汉字之间的空格
    if ref and '\u4e00' <= ref[0] <= '\u9fff':
        ref = re.sub(r'([\u4e00-\u9fff])\s+([\u4e00-\u9fff])', r'\1\2', ref)
    return ref

def main():
    # 读取文本文件
    with open('论文正文内容.txt', 'r', encoding='utf-8') as f:
        text = f.read()
    
    # 提取引用
    citations = extract_citations(text)
    
    # 在参考文献中查找匹配
    found_refs, not_found_refs = find_references(citations, '参考文献库.txt')
    
    # 保存结果，已找到的先输出，未找到的排最后
    with open('提取的引用.txt', 'w', encoding='utf-8') as f:
        idx = 1
        for ref in found_refs:
            ref_clean = clean_ref_for_output(ref)
            f.write(f'[{idx}] {ref_clean}\n')
            idx += 1
        for ref in not_found_refs:
            ref_clean = clean_ref_for_output(ref)
            f.write(f'[{idx}] {ref_clean}\n')
            idx += 1

if __name__ == '__main__':
    main() 