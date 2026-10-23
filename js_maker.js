/* =========================================================
   js_maker.js — Era 메이커 공통 유틸리티 및 ERB 파서
   ========================================================= */
(function (global) {
  'use strict';

  const PRINT_PREFIX = /^(PRINTFORML|PRINTFORMW|PRINTFORMDL|PRINTFORMDW|PRINTFORM|PRINTW|PRINT)\s+/;

  /* ---------------- 이름 / 조사 변환 ---------------- */
  function applyNameAndJosaConversion(text, placeholder, callName, talentKey) {
    let result = text;
    const patterns = [
      { josa: ['으로', '로'] },
      { josa: ['은', '는'] },
      { josa: ['이', '가'] },
      { josa: ['을', '를'] },
      { josa: ['과', '와'] }
    ];

    patterns.forEach(({ josa }) => {
      const regex = new RegExp('\\[' + placeholder + '\\](' + josa.join('|') + ')', 'g');
      result = result.replace(regex, () => {
        return callName + '\\@ ' + talentKey + ' ? ' + josa[0] + ' # ' + josa[1] + ' \\@';
      });
    });

    result = result.replace(new RegExp('\\[' + placeholder + '\\]', 'g'), callName);
    return result;
  }

  function convertNames(text) {
    let t = text;
    t = applyNameAndJosaConversion(t, '이름', '%CALLNAME:MASTER%', 'TALENT:MASTER:170');
    t = applyNameAndJosaConversion(t, '당신', '%CALLNAME:MASTER%', 'TALENT:MASTER:170');
    t = applyNameAndJosaConversion(t, '남사', '%CALLNAME:TARGET%', 'TALENT:TARGET:170');
    return t;
  }

  /* ---------------- 대사 판별 ---------------- */
  function isDialogLine(text) {
    return /^"[^"]*"$/.test(text) || /^「[\s\S]*」$/.test(text);
  }

function transformText(text) {
    let t = convertNames(text);
    t = t.replace(/\.\.\./g, '…');
    t = t.replace(/"([^"\n]*)"/g, '「$1」');

    const lines = t.split('\n');
    const result = [];
    let chunk = [];

    const flushChunk = () => {
      if (chunk.length === 0) return;
      for (let i = 0; i < chunk.length; i++) {
        const item = chunk[i];
        const isLast = (i === chunk.length - 1);

        // 이미 ERB 명령어(PRINT, IF, ELSE 등 영문 시작)인 경우 그대로 출력
        if (/^[A-Za-z_]+/.test(item.text.trim()) && !/^[a-z]/.test(item.text.trim())) {
           result.push(item.text.trim());
           continue;
        }

        let clean = item.text.replace(PRINT_PREFIX, '').trim();

        let numMatch = clean.match(/^(\d+)\.\s*(?:\[([^\]]+)\])?\s*(.*)$/);
        if (numMatch) {
          const num = numMatch[1];
          const bracket = numMatch[2] !== undefined ? `[${numMatch[2]}]` : '';
          const body = numMatch[3].trim();
          const isBodyDialog = isDialogLine(body);

          let cmd = isLast
            ? (isBodyDialog ? 'PRINTFORMW' : 'PRINTFORMDW')
            : (isBodyDialog ? 'PRINTFORML' : 'PRINTFORMDL');

          result.push(cmd + ' ' + num + '.' + bracket + ' ' + body);
          if (cmd.endsWith('W')) {
            result.push('');
          }
        } else {
          let cmd = isLast
            ? (item.isDialog ? 'PRINTFORMW' : 'PRINTFORMDW')
            : (item.isDialog ? 'PRINTFORML' : 'PRINTFORMDL');

          result.push(cmd + ' ' + clean);
          if (cmd.endsWith('W')) {
            result.push('');
          }
        }
      }
      chunk = [];
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let trimmed = line.trim();

      // 빈 줄 처리
      if (trimmed === '') {
        flushChunk();
        if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('');
        }
        continue;
      }

      // ★ 영문(알파벳) 또는 @로 시작하는 ERB 제어문은 텍스트로 묶지 않고 즉시 분리
      if (/^[A-Za-z_@]/.test(trimmed) && !/^"[A-Za-z]/.test(trimmed)) {
        // 하지만 기존 대사("...")나 문장이 영문으로 시작할 수도 있으므로
        // ERB 예약어(IF, ELSE, ENDIF, RETURN, PRINT, SET 등)인지 확인
        if (/^(IF|ELSE|ELSEIF|ENDIF|RETURN|PRINT|SET|LOCAL|CASE|SELECTCASE|ENDSELECT|INPUT|CALL|GOTO|JUMP|DO|WHILE|REPEAT|BREAK|CONTINUE|DATA|STR|FOR)\b/i.test(trimmed)) {
          flushChunk();
          result.push(trimmed);
          continue;
        }
      }

      if (/^\d+\./.test(trimmed) && chunk.length > 0) {
        flushChunk();
      }

      chunk.push({ text: trimmed, isDialog: isDialogLine(trimmed) });
    }
    flushChunk();

    return result.join('\n');
  }
  
  function parseBlocks(text) {
    let lines = text.split('\n');
    let blocks = [];
    let currentBlock = null;

    lines.forEach(line => {
      let clean = line.trim();
      if (!clean) return;

      let match = clean.match(/^(PRINTFORML|PRINTFORMW|PRINTFORMDL|PRINTFORMDW)\s+(.*)$/);
      let prefix = 'PRINTFORML';
      let content = clean;
      if (match) {
        prefix = match[1];
        content = match[2];
      }

      let numMatch = content.match(/^(\d+)\.\s*(?:\[([^\]]+)\])?\s*(.*)$/);
      if (numMatch) {
        if (currentBlock) blocks.push(currentBlock);
        
        let bracketNums = [];
        if (numMatch[2] !== undefined) {
          bracketNums = numMatch[2].split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !isNaN(n));
        }

        currentBlock = {
          num: parseInt(numMatch[1], 10),
          bracketNums: bracketNums,
          explicitNum: true,
          lines: []
        };
        
        if (numMatch[3]) {
          currentBlock.lines.push(prefix + ' ' + numMatch[3]);
        }
      } else {
        if (currentBlock) {
          currentBlock.lines.push(prefix + ' ' + content);
        } else {
          currentBlock = { num: 1, bracketNums: [], explicitNum: false, lines: [] };
          currentBlock.lines.push(prefix + ' ' + content);
        }
      }
    });
    if (currentBlock) blocks.push(currentBlock);
    return blocks;
  }

  /* ---------------- 선택지 관리 ---------------- */
  function createChoiceItem(option, content) {
    const item = document.createElement('div');
    item.className = 'choice-item';
    item.innerHTML =
      '<div class="choice-head">' +
        '<span class="choice-num">선택 1</span>' +
        '<button type="button" class="del-choice-btn">[-]</button>' +
      '</div>' +
      '<label>선택지' +
        '<input type="text" class="choice-option" placeholder="예: 어떻게 할까?" autocomplete="off">' +
      '</label>' +
      '<label>내용' +
        '<textarea class="choice-content" rows="3" spellcheck="false" ' +
          'placeholder="여러 줄 작성 가능합니다."></textarea>' +
      '</label>';
    item.querySelector('.choice-option').value = option || '';
    item.querySelector('.choice-content').value = content || '';
    return item;
  }

  function renumberChoices(container) {
    const items = container.querySelectorAll('.choice-item');
    items.forEach((item, i) => {
      item.querySelector('.choice-num').textContent = '선택 ' + (i + 1);
    });
    const count = items.length;
    container.querySelectorAll('.del-choice-btn').forEach(btn => {
      btn.disabled = count <= 2;
    });
  }

  function addChoiceItem(container, option, content) {
    const item = createChoiceItem(option, content);
    const addBtn = container.querySelector('.add-choice-btn');
    addBtn.before(item);
    renumberChoices(container);
    return item;
  }

  function ensureMinChoices(container) {
    while (container.querySelectorAll('.choice-item').length < 2) {
      addChoiceItem(container);
    }
    renumberChoices(container);
  }

  function clearChoices(container) {
    container.querySelectorAll('.choice-item').forEach(el => el.remove());
  }

  function getChoiceList(container) {
    const list = [];
    container.querySelectorAll('.choice-item').forEach(item => {
      list.push({
        option: item.querySelector('.choice-option').value,
        content: item.querySelector('.choice-content').value
      });
    });
    return list;
  }

  function setupChoicesContainer(container, options) {
    if (container.dataset.bound === '1') return;
    container.dataset.bound = '1';

    const onAdd    = (options && options.onAdd)    || function () {};
    const onDelete = (options && options.onDelete) || function () {};

    container.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.del-choice-btn');
      if (delBtn) {
        if (container.querySelectorAll('.choice-item').length <= 2) return;
        delBtn.closest('.choice-item').remove();
        renumberChoices(container);
        onDelete();
        return;
      }
      const addBtn = e.target.closest('.add-choice-btn');
      if (addBtn) {
        addChoiceItem(container);
        onAdd();
        const items = container.querySelectorAll('.choice-item');
        const last = items[items.length - 1];
        const inp = last && last.querySelector('.choice-option');
        if (inp) inp.focus();
      }
    });
  }

  function toggleChoicesArea(checkbox, container, options) {
    if (checkbox.checked) {
      container.style.display = 'block';
      setupChoicesContainer(container, options);
      ensureMinChoices(container);
    } else {
      container.style.display = 'none';
      clearChoices(container);
    }
  }

  function getContentCharCount(text) {
    if (!text || !text.trim()) return 0;

    let t = text;
    if (!/PRINTFORM[LW]|PRINTFORMD[LW]|PRINTFORM|PRINTW|PRINT\b/.test(t)) {
      t = transformText(t);
    }

    const blocks = parseBlocks(t);
    let count = 0;
    blocks.forEach(block => {
      block.lines.forEach(line => {
        const match = line.match(/^(PRINTFORML|PRINTFORMW|PRINTFORMDL|PRINTFORMDW)\s+(.*)$/);
        if (match) {
          let content = match[2];
          if (/^「\s*」$/.test(content.trim())) return;
          count += content.length;
        }
      });
    });
    return count;
  }

  function initHeaderNav(currentPage) {
    let page = currentPage;
    if (!page) {
      page = document.body.getAttribute('data-page') || '';
    }
    if (!page) return;

    const links = document.querySelectorAll('.header-nav a[data-nav]');
    links.forEach(a => {
      const isActive = (a.dataset.nav === page);
      a.classList.toggle('active', isActive);
      if (isActive) {
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  global.EraCommon = {
    PRINT_PREFIX,
    applyNameAndJosaConversion,
    convertNames,
    isDialogLine,
    transformText,
    parseBlocks,
    getContentCharCount,
    initHeaderNav,
    createChoiceItem,
    renumberChoices,
    addChoiceItem,
    ensureMinChoices,
    clearChoices,
    getChoiceList,
    setupChoicesContainer,
    toggleChoicesArea
  };
  
})(window);

/* ============================================================
   ERB 역파싱 (불러오기)
   ============================================================ */
(function (global) {
  'use strict';

  function splitFunctions(text) {
    const lines = text.split('\n');
    const funcs = {};
    let currentFuncName = null;
    let currentLines = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        if (currentFuncName) {
          funcs[currentFuncName] = currentLines;
        }
        currentFuncName = trimmed.substring(1).trim();
        currentLines = [];
      } else if (currentFuncName) {
        currentLines.push(line);
      }
    });
    if (currentFuncName) {
      funcs[currentFuncName] = currentLines;
    }
    return funcs;
  }

  function parseConceptBody(bodyLines) {
    let textLines = [];
    let useChoices = false;
    let choices = [];
    let mergeLines = [];

    let i = 0;
    while (i < bodyLines.length) {
      if (bodyLines[i].trim().startsWith('IF LOCAL')) {
        i++;
        break;
      }
      i++;
    }

    let choiceOptions = [];
    let choiceContents = {};
    let currentCaseIndex = null;
    let mode = 'NORMAL';

    while (i < bodyLines.length) {
      const line = bodyLines[i];
      const trimmed = line.trim();

// ';선택지' 마커를 먼저 확인
if (trimmed === ';선택지') {
  useChoices = true;
  mode = 'CHOICES';
  i++;
  continue;
}

if (trimmed === 'ENDIF' || trimmed === 'RETURN LOCAL' || trimmed.startsWith(';')) {
  i++;
  continue;
}

      if (mode === 'CHOICES') {
        if (trimmed === 'INPUT' || trimmed.startsWith('SELECTCASE')) {
          mode = 'CASES';
          i++;
          continue;
        }
        const match = trimmed.match(/^PRINTFORM[D]?[L|W]?\s+\[(\d+)\]\s+(.*)$/);
        if (match) {
          choiceOptions.push({
            index: parseInt(match[1], 10),
            option: match[2]
          });
        }
        i++;
        continue;
      }

      if (mode === 'CASES') {
        if (trimmed === 'ENDSELECT') {
          mode = 'MERGE';
          i++;
          continue;
        }
        const caseMatch = trimmed.match(/^CASE\s+(\d+)$/);
        if (caseMatch) {
          currentCaseIndex = parseInt(caseMatch[1], 10);
          if (!choiceContents[currentCaseIndex]) {
            choiceContents[currentCaseIndex] = [];
          }
          i++;
          continue;
        }
        if (currentCaseIndex !== null) {
          const printMatch = trimmed.match(/^(PRINTFORM[LW]|PRINTFORMD[LW]|PRINTFORM|PRINTW|PRINT)\s+(.*)$/);
          if (printMatch) {
            choiceContents[currentCaseIndex].push(printMatch[2]);
            // ★ W 명령어라면 빈 줄 추가
            if (printMatch[1].endsWith('W')) {
              choiceContents[currentCaseIndex].push('');
            }
          } else {
            choiceContents[currentCaseIndex].push(trimmed);
          }
        }
        i++;
        continue;
      }

      const printMatch = trimmed.match(/^(PRINTFORM[LW]|PRINTFORMD[LW]|PRINTFORM|PRINTW|PRINT)\s+(.*)$/);
      let cleanLine = printMatch ? printMatch[2] : trimmed;

      if (mode === 'MERGE' || (useChoices && mode === 'NORMAL' && choiceOptions.length > 0)) {
        mode = 'MERGE';
        mergeLines.push(cleanLine);
        // ★ W 명령어라면 빈 줄 추가
        if (printMatch && printMatch[1].endsWith('W')) {
          mergeLines.push('');
        }
      } else {
        textLines.push(cleanLine);
        // ★ W 명령어라면 빈 줄 추가
        if (printMatch && printMatch[1].endsWith('W')) {
          textLines.push('');
        }
      }

      i++;
    }

    choiceOptions.forEach(item => {
      const contentLines = choiceContents[item.index] || [];
      choices.push({
        option: item.option,
        content: contentLines.join('\n')
      });
    });

    if (choices.length > 0) {
      useChoices = true;
    }

    let merges = [];
    if (mergeLines.length > 0) {
      merges.push(mergeLines.join('\n'));
    }

    return {
      text: textLines.join('\n').trim(),
      useChoices: useChoices,
      choices: choices,
      merges: merges
    };
  }

  function parseERB(rawText) {
    const data = {
      charNum: '',
      charName: '',
      color1: '',
      color2: '',
      allowEdit: true,
      allowAdd: true,
      allowMod: true,
      openingText: '',
      openingUseChoices: false,
      openingChoices: [],
      openingMerges: [],
      introText: '',
      introUseChoices: false,
      introChoices: [],
      introMerges: [],
      weddingText: '',
      LoveText: '',
      stopToukenText: '',
      stopSaniwaText: ''
    };

    const lines = rawText.split('\n');

// ✅ 수정 후
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // 캐릭터명: ";[캐릭터명] 구상" 패턴만 인식 (다른 "~구상" 주석은 무시)
  const nameMatch = line.match(/^;\[([^\]]+)\]\s*구상$/);
  if (nameMatch) {
    data.charName = nameMatch[1].trim();
    // 최초 발견 시 확정. 이후 다른 ;[...] 구상이 나와도 덮어쓰지 않음
    continue;
  }

  // 개변 여부는 헤더 주석에서만 (모든 주석 스캔)
  if (line.startsWith(';수정 ')) data.allowEdit = !line.includes('▷ 불가');
  if (line.startsWith(';가필 ')) data.allowAdd  = !line.includes('▷ 불가');
  if (line.startsWith(';개변 ')) data.allowMod  = !line.includes('▷ 불가');
}

    const funcs = splitFunctions(rawText);

    for (const funcName of Object.keys(funcs)) {
      const match = funcName.match(/^KOJO_K(\d+)$/);
      if (match) {
        data.charNum = match[1];
        break;
      }
      const colorMatch = funcName.match(/^KOJO_COLOR_K(\d+)$/);
      if (colorMatch) {
        data.charNum = colorMatch[1];
      }
    }

    const colorFuncKey = 'KOJO_COLOR_K' + data.charNum;
    if (funcs[colorFuncKey]) {
      funcs[colorFuncKey].forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('SETCOLOR')) {
          const hexMatch = trimmed.match(/0x([0-9a-fA-F]{6})/);
          if (hexMatch) {
            if (!data.color1) {
              data.color1 = hexMatch[1];
            } else if (!data.color2) {
              data.color2 = hexMatch[1];
            }
          }
        }
      });
    }

    const openingKey = 'KOJO_OPENING_K' + data.charNum + '_LOG';
    if (funcs[openingKey]) {
      const parsed = parseConceptBody(funcs[openingKey]);
      data.openingText = parsed.text;
      data.openingUseChoices = parsed.useChoices;
      data.openingChoices = parsed.choices;
      data.openingMerges = parsed.merges;
    }

    const introKey = 'KOJO_OPENING_K' + data.charNum + '_INTRO';
    if (funcs[introKey]) {
      const parsed = parseConceptBody(funcs[introKey]);
      data.introText = parsed.text;
      data.introUseChoices = parsed.useChoices;
      data.introChoices = parsed.choices;
      data.introMerges = parsed.merges;
    }

    const weddingKey = 'KOJO_WEDDING_K' + data.charNum + '_LOG';
    if (funcs[weddingKey]) {
      data.weddingText = parseConceptBody(funcs[weddingKey]).text;
    }

    const loveKey = 'KOJO_LOVE_K' + data.charNum + '_LOG';
    if (funcs[loveKey]) {
      data.LoveText = parseConceptBody(funcs[loveKey]).text;
    }

    const stopToukenKey = 'KOJO_TOUKEN_K' + data.charNum + '_STOP';
    if (funcs[stopToukenKey]) {
      data.stopToukenText = parseConceptBody(funcs[stopToukenKey]).text;
    }

    const stopSaniwaKey = 'KOJO_SANIWA_K' + data.charNum + '_STOP';
    if (funcs[stopSaniwaKey]) {
      data.stopSaniwaText = parseConceptBody(funcs[stopSaniwaKey]).text;
    }

    return data;
  }

  global.EraERBParser = { parseERB };
})(window);