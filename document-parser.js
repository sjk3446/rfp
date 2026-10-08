/* Shared, offline document parsing. No network calls or project storage. */
(function (root, factory) {
  const parser = factory();
  if (typeof module === 'object' && module.exports) module.exports = parser;
  else root.ReqlyDocumentParser = parser;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  const inline = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const multiline = value => String(value ?? '').replace(/\r\n?/g, '\n')
    .split('\n').map(line => line.replace(/[\t\u00a0 ]+/g, ' ').trimEnd())
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const idLabel = /(?:요구\s*사항|요건|requirement|req)\s*(?:고유\s*번호|식별\s*번호|ID|번호|No\.?)\s*[:：#|]?\s*/i;
  const nameLabel = /^(?:요구\s*사항|요건|requirement)\s*(?:명칭|명|제목|name|title)\s*[:：|]?\s*/i;
  const categoryLabel = /(?:요구\s*사항|요건)\s*(?:분류|유형)\s*[:：|]?\s*/i;
  const definitionLabel = /^정의(?=$|[\s:：|])\s*[:：|]?\s*/;
  const bodyLabel = /^(?:요구\s*사항\s*상세\s*(?:설명|내용)|상세\s*(?:설명|내용)|세부\s*(?:내용|요건))\s*[:：|]?\s*/;
  const outputLabel = /^산출물(?=$|\s*[:：|※])\s*[:：|]?\s*/;
  const bullet = /^\s*(?:[-－–—•▪◦●○⚬□■※]|\d+[.)]|[가-힣][.)])\s*/;
  const technicalId = /^(?:AES|SHA|RSA|TLS|SSL|HTTP|HTTPS|IPV|ISO|IEC|IEEE|RFC|UTF|AL32UTF|MSWIN|RAID|QSFP|DDR|PCI|CORE|V(?:ER)?)[-_./]?\d/i;
  const headingId = /^\s*(?:[-•▪◦●○□■]|\d+[.)])?\s*((?:[A-Z][A-Z0-9]*(?:[-_./][A-Z0-9]+)*[-_./]\d{1,6})|(?:[A-Z]{2,15}\d{2,6}))(?=$|[\s|:：)])/;

  function declaredId(line) {
    const match = String(line).match(idLabel);
    if (!match) return '';
    const tail = String(line).slice(match.index + match[0].length).trim();
    // Labelled cells may use numeric or Korean IDs; never take ordinary prose.
    const token = tail.match(/^([A-Za-z가-힣0-9]+(?:\s*[-_./]\s*[A-Za-z가-힣0-9]+)*)(?=$|[\s|,;])/);
    const value = token?.[1].replace(/\s*([-_./])\s*/g, '$1') || '';
    return /\d/.test(value) && !/^\d+\s*개$/.test(value) && value.length <= 60 ? value : '';
  }

  function headingIdFrom(line) {
    const id = String(line).match(headingId)?.[1] || '';
    return technicalId.test(id) ? '' : id;
  }

  function titleFrom(text, id = '') {
    let first = String(text).split('\n').find(line => line.trim()) || '';
    first = inline(first).replace(bullet, '');
    if (id && first.startsWith(id)) first = first.slice(id.length).replace(/^[\s|:：_./-]+/, '');
    first = first.split('|')[0].trim();
    return first.length > 120 ? first.slice(0, 117) + '…' : first || '요구사항';
  }

  function pdfPageText(items, previousLayout = null) {
    let spans = items.filter(item => typeof item.str === 'string' && item.str.trim() && item.transform)
      .map(item => ({...item, x:item.transform[4], y:item.transform[5], h:Math.max(item.height || 0, Math.abs(item.transform[3]) || 0, 1)}));
    for (const item of spans) {
      const baseline = spans.filter(other => other !== item && item.h < other.h*.8 && Math.abs(item.y-other.y)<=other.h*.6 &&
        Math.abs(item.x-(other.x+other.width))<=other.h*2).sort((a,b)=>Math.abs(a.y-item.y)-Math.abs(b.y-item.y))[0];
      if (baseline) item.y=baseline.y;
    }
    // PDF.js versions/fonts may split a label into separate word fragments.
    // Reassemble neighbouring fragments before recognising table cell labels.
    const baselineRows=[];
    for (const item of spans.sort((a,b)=>b.y-a.y || a.x-b.x)) {
      const row=baselineRows[baselineRows.length-1];
      if (row && Math.abs(row.y-item.y)<=Math.min(3,Math.max(row.h,item.h)*.25)) row.items.push(item);
      else baselineRows.push({y:item.y,h:item.h,items:[item]});
    }
    spans=[];
    for (const row of baselineRows) {
      let last;
      for (const item of row.items.sort((a,b)=>a.x-b.x)) {
        const gap=last ? item.x-(last.x+last.width) : Infinity;
        if (last && gap<=Math.max(last.h,item.h)*.9) {
          const separator=gap>Math.max(.7,item.h*.12) && !/\s$/.test(last.str) && !/^\s/.test(item.str)?' ':'';
          last.str+=separator+item.str;
          last.width=Math.max(last.width,item.x+item.width-last.x);
          last.h=Math.max(last.h,item.h);
        } else { last={...item};spans.push(last); }
      }
    }
    const nameSpan = spans.find(item => nameLabel.test(inline(item.str)));
    const definitionSpan = spans.find(item => inline(item.str) === '정의');
    let bodyX = null;
    for (const label of [nameSpan, definitionSpan].filter(Boolean)) {
      const right = spans.filter(item => Math.abs(item.y-label.y) < label.h * 1.25 && item.x > label.x + (label.width || 0) + 2)
        .sort((a,b) => Math.abs(a.y-label.y)-Math.abs(b.y-label.y) || a.x-b.x)[0];
      if (right) { bodyX = right.x; break; }
    }
    const sideLabel = /^(?:요구|사항|상세|설명|세부|내용|요구\s*사항\s*상세\s*설명|세부\s*내용)$/;
    const hasSideLabels = spans.filter(item => sideLabel.test(inline(item.str))).length >= 3;
    const contentSpans = spans.filter(item => item.y >= 65);
    const continuation = previousLayout?.tableLayout && previousLayout.bodyX !== null && contentSpans.length &&
      contentSpans.every(item => item.x >= previousLayout.bodyX - 2 || sideLabel.test(inline(item.str)) || /^(?:정의|산출물)$/.test(inline(item.str)));
    const tableLayout = Boolean(nameSpan || definitionSpan || hasSideLabels || continuation ||
      spans.some(item => /^(?:요구\s*사항|요건)\s*(?:ID|고유\s*번호|식별\s*번호|번호)\s*$/i.test(inline(item.str))));
    if (bodyX === null && continuation) bodyX = previousLayout.bodyX;
    if (bodyX === null && tableLayout) {
      const headings = spans.filter(item => /^[□■]/.test(item.str));
      if (headings.length) bodyX = Math.min(...headings.map(item => item.x));
    }
    // Cell labels are vertically centred: put them before the cell's first line,
    // not between its wrapped lines (which would corrupt names/definitions).
    const labels = tableLayout && bodyX !== null ? spans.filter(item => item.x < bodyX - 2 &&
      /^(?:요구\s*사항\s*명칭|정의|산출물)$/.test(inline(item.str))) : [];
    const kept = spans.filter(item => {
      if (/^[\d\s\-–—]+$/.test(inline(item.str)) && item.y < 65) return false;
      if (labels.includes(item)) return false;
      return !(tableLayout && bodyX !== null && item.x < bodyX - 2 && sideLabel.test(inline(item.str)));
    }).sort((a,b) => b.y-a.y || a.x-b.x);
    const rows = [];
    for (const item of kept) {
      const row = rows[rows.length-1];
      if (row && Math.abs(row.y-item.y) <= Math.min(3, Math.max(row.h,item.h)*.25)) row.items.push(item);
      else rows.push({y:item.y,h:item.h,items:[item]});
    }
    for (const label of labels) {
      const valueRows = rows.filter(row => row.items.some(item => item.x >= bodyX - 2));
      const nearest = valueRows.reduce((best, row) => !best || Math.abs(row.y-label.y)<Math.abs(best.y-label.y)?row:best, null);
      if (!nearest) continue;
      let index = valueRows.indexOf(nearest);
      while (index > 0 && valueRows[index-1].y-valueRows[index].y <= Math.max(valueRows[index-1].h,valueRows[index].h)*1.8 &&
        !valueRows[index-1].items.some(item => idLabel.test(item.str) || categoryLabel.test(item.str))) index--;
      const target = valueRows[index];
      (target.labels ||= []).push(inline(label.str));
    }
    const lines = [];
    let previous;
    for (const row of rows) {
      row.items.sort((a,b)=>a.x-b.x);
      let line='', last;
      for (const item of row.items) {
        const gap = last ? item.x - (last.x + last.width) : 0;
        if (last && gap > Math.max(.7, item.h*.12) && !/\s$/.test(line) && !/^\s/.test(item.str)) line+=' ';
        line += item.str;
        last=item;
      }
      line=line.trim();
      if (previous && previous.y-row.y > Math.max(row.h, previous.h)*1.8) lines.push('');
      if (row.labels) lines.push(...row.labels);
      lines.push(line);
      previous=row;
    }
    return {text:lines.join('\n'), tableLayout, bodyX};
  }

  function records(text) {
    let page=1, sheet='', row=0;
    const result=[];
    for (const original of String(text ?? '').replace(/\r\n?/g,'\n').split('\n')) {
      const line=original.trim();
      let match=line.match(/^\[\[PAGE:(\d+)]]$/);
      if(match){page=Number(match[1]);continue;}
      match=line.match(/^\[\[SHEET:(.+)]]$/);
      if(match){sheet=match[1];continue;}
      match=line.match(/^\[\[ROW:(\d+)]]$/);
      if(match){row=Number(match[1]);continue;}
      if(line==='[[TABLE_LAYOUT]]'){result.push({tableMarker:true,page,sheet,row,line:''});continue;}
      result.push({line,page,sheet,row,source:sheet?`${sheet} 시트 · ${row||1}행`:`${page}페이지`});
    }
    return result;
  }

  function formRequirements(lines) {
    const starts=[];
    for(let i=0;i<lines.length;i++) {
      const id=declaredId(lines[i].line);
      if(!id)continue;
      const next=lines.slice(i+1,i+9).find(record=>nameLabel.test(record.line));
      if(next)starts.push({index:i,id});
    }
    if(!starts.length)return [];
    const tablePages=new Set(lines.filter(record=>record.tableMarker).map(record=>record.page));
    const result=[];
    for(let n=0;n<starts.length;n++) {
      const start=starts[n], header=lines[start.index];
      const end=starts[n+1]?.index ?? lines.length;
      const block=lines.slice(start.index+1,end);
      let name='', category='', parts=[], section='name', lastPage=header.page;
      const categoryMatch=header.line.match(categoryLabel);
      if(categoryMatch)category=header.line.slice(categoryMatch.index+categoryMatch[0].length).split(idLabel)[0].trim();
      for(const record of block) {
        if(record.tableMarker)continue;
        if(record.page!==lastPage) {
          // Inner attachments can use full-width tables, unlike the form itself.
          // A following explicit form is the reliable boundary, not page layout.
          if(n===starts.length-1 && tablePages.size && !tablePages.has(record.page))break;
          lastPage=record.page;
        }
        const line=record.line;
        if(/^[-–—]\s*\d+\s*[-–—]$/.test(line))continue;
        if(nameLabel.test(line)){name=inline(line.replace(nameLabel,''));section='name';continue;}
        if(definitionLabel.test(line)){parts.push('정의',line.replace(definitionLabel,''));section='body';continue;}
        if(bodyLabel.test(line)){if(section!=='body')section='body';const rest=line.replace(bodyLabel,'');if(rest)parts.push(rest);continue;}
        if(outputLabel.test(line)){parts.push('', '산출물', line.replace(outputLabel,''));section='outputs';continue;}
        if(section==='name') {
          if(/^[□■•⚬○◦-]/.test(line)){section='body';parts.push(line);}
          else if(line)name=inline(`${name} ${line}`);
        } else {
          // After deliverables, a new non-table chapter is outside this requirement.
          if(section==='outputs' && (/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.．]/.test(line) ||
            /^(?:\d+[.．]|[□■])\s*.*요\s*구\s*사\s*항\s*[（(]/.test(line)))break;
          parts.push(line);
        }
      }
      const description=multiline(parts.join('\n'));
      if(name && description)result.push({id:start.id,name,description,category,source:header.source,section:'요구사항 상세',basis:'요구사항 표의 ID·명칭·상세 내용'});
    }
    return result;
  }

  function buildTextRequirements(text, {obligation, soft} = {}) {
    const lines=records(text);
    const forms=formRequirements(lines);
    if(forms.length)return forms;
    const headingIds=lines.map(record=>headingIdFrom(record.line)).filter(Boolean);
    const hasIdHeadings=headingIds.length>0;
    const candidates=[];
    let current=null;
    const flush=()=>{if(current){current.description=multiline(current.parts.join('\n'));delete current.parts;candidates.push(current);current=null;}};
    for(const record of lines) {
      if(record.tableMarker)continue;
      const {line}=record;
      if(!line){if(current)current.parts.push('');continue;}
      if(/^[-–—]?\s*\d+\s*[-–—]?$/.test(line))continue;
      const declared=declaredId(line), id=declared || headingIdFrom(line);
      if(id) {
        flush(); current={...record,id,name:titleFrom(line,id),parts:[line],basis:declared?'명시 ID':'요구사항 ID 제목'};
      } else if(hasIdHeadings) {
        if(current)current.parts.push(line);
      } else {
        const signal=obligation?.test(line)||soft?.test(line);
        if(signal){flush();current={...record,id:'',parts:[line],basis:'목록·서술 분석'};}
        else if(current && current.page===record.page)current.parts.push(line);
        else if(current)flush();
      }
    }
    flush();
    return candidates;
  }

  return {inline,multiline,declaredId,headingIdFrom,titleFrom,pdfPageText,buildTextRequirements};
});
