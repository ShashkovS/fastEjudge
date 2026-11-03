// browser://extensions/

/**
 Как собрать highlight.js
 Клонируем https://github.com/highlightjs/highlight.js.git
 Ставим либы: npm ci
 Собираем под нужные языки (см. https://highlightjs.readthedocs.io/en/latest/building-testing.html#building)
 node ./tools/build.js -t browser python cpp
 */


function getElementByXpath(path) {
  return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function removeTrash() {
  const container = document.getElementById('container');

  let startDel = false;
  let el;
  const toDel = [];
  for (el of container.childNodes) {
    if (el.nodeName === 'H2' && el.textContent === 'Server status') {
      startDel = true;
    } else if (el.nodeName === 'H2' && el.textContent === 'Submissions') {
      break;
    }
    if (startDel) {
      toDel.push(el);
    }
  }
  if (el.nodeName === 'H2' && el.textContent === 'Submissions') {
    toDel.push(el);
    const f1 = el.nextElementSibling;
    const f2 = f1.nextElementSibling;
    f1.innerHTML = f1.innerHTML + '; ' + f2.innerHTML;
    toDel.push(f2);
    for (const el of toDel) {
      if (el.tagName !== 'FORM') {
        el.remove();
      } else {
        const formC = el.children;
        if (formC[1].tagName === 'TABLE') {
          const rows = formC[1].firstElementChild.children;
          if (rows.length === 6) {
            rows[5].remove();
            rows[4].remove();
            rows[3].remove();
            rows[2].remove();
            rows[0].remove();
          }
        }
      }
    }
  }
}


function makeTablesSortable() {
  const getCellValue = (tr, idx) => tr.children[idx].innerText || tr.children[idx].textContent;
  const comparer = (idx, asc) => (a, b) => ((v1, v2) =>
      v1 !== '' && v2 !== '' && !isNaN(v1) && !isNaN(v2) ? v1 - v2 : v1.toString().localeCompare(v2)
  )(getCellValue(asc ? a : b, idx), getCellValue(asc ? b : a, idx));

// do the work...
  document.querySelectorAll('th').forEach(th => th.addEventListener('click', (() => {
    const table = th.closest('table');
    Array.from(table.querySelectorAll('tr:nth-child(n+2)'))
         .sort(comparer(Array.from(th.parentNode.children).indexOf(th), this.asc = !this.asc))
         .forEach(tr => table.appendChild(tr));
  })));
}

function highlightCode() {
  const code = document.getElementById('prog');
  if (code) {
    const text = code.innerText.replace(/^(?:\[\d+\]\n)*\t/, '');
    const pre = document.createElement('pre');
    pre.innerHTML = hljs.highlight(text, {language: 'python', ignoreIllegals: true}).value;
    pre.style = "font-size:150%";
    code.parentNode.replaceChild(pre, code);
  }
}

function findRunsTable() {
  const header = Array.from(document.querySelectorAll('th')).filter(el => el.innerText === "Run ID");
  if (header.length > 0) {
    return header[0].closest('table');
  }
}


function parseRunsTable(runsTable) {
  const probToName = getListOfProblemNames();
  const headers = Array.from(runsTable.rows[0].cells).map(el => el.innerText);
  const needColumns = ["Run ID", "Problem", "Language", "Result", "Source"];
  const colNums = {};
  headers.forEach((hdr, idx) => colNums[hdr] = idx);
  needColumns.forEach(el => colNums[el] !== undefined || alert(`В таблице посылок нет столбца ${el}`));
  const runsToAdd = [];
  for (let rowNum = 1; rowNum < runsTable.rows.length; rowNum++) {
    const curRowCells = runsTable.rows[rowNum].cells;
    const thisRun = {};
    headers.forEach(hdr => thisRun[hdr] = curRowCells[colNums[hdr]].innerText);
    thisRun['tr'] = runsTable.rows[rowNum].cloneNode(deep = true);
    thisRun['authorFilter'] = getAuthorFilterExpression(thisRun['tr'], headers);
    thisRun['sourceUrl'] = getRunSourceUrl(thisRun['tr'], thisRun['Run ID']);
    const problemCell = thisRun['tr'].cells[colNums["Problem"]];
    // Заменяем короткое название на длинное
    problemCell.innerText = problemCell.innerText + ' - ' + (probToName.get(problemCell.innerText.replace(/-\d+$/, '')) || '');
    runsToAdd.push(thisRun);
    // https://server.179.ru/cgi-bin/new-judge?SID=10a2e6abb4590c55&action=91&run_id=787
  }
  return runsToAdd;
}

function getProblemCode(problem) {
  return problem.trim().split(/\s+-\s+/)[0].replace(/-\d+$/, '');
}

function getPreviousProblemCode(problem) {
  const select = document.getElementsByName('problem')[0];
  if (!select) return null;
  const problems = Array.from(select.options)
    .map(option => option.innerText.match(/^(.+?)\s+-\s+.+$/))
    .filter(Boolean)
    .map(match => match[1]);
  const index = problems.indexOf(getProblemCode(problem));
  return index > 0 ? problems[index - 1] : null;
}

function filterStringLiteral(value) {
  // Синтаксис фильтра ejudge использует строковые литералы в двойных кавычках.
  return JSON.stringify(value);
}

function getAuthorFilterExpression(runTr, headers) {
  // В современных ejudge ID ученика есть в ссылке на его карточку. В старых
  // инсталляциях может быть отдельный столбец User ID или только Login.
  const links = Array.from(runTr.querySelectorAll('a[href]'));
  for (const link of links) {
    const url = new URL(link.href, window.location.href);
    const userId = url.searchParams.get('user_id');
    if (userId && /^\d+$/.test(userId)) return `uid == ${userId}`;
  }

  const normalizedHeaders = headers.map(header => header.trim().toLowerCase());
  const userIdColumn = normalizedHeaders.findIndex(header =>
    /^(user id|uid|id user)$/.test(header)
  );
  const userId = userIdColumn < 0 ? '' : runTr.cells[userIdColumn].textContent.trim();
  if (/^\d+$/.test(userId)) return `uid == ${userId}`;

  const loginColumn = normalizedHeaders.findIndex(header =>
    /^(login|user login)$/.test(header)
  );
  const login = loginColumn < 0 ? '' : runTr.cells[loginColumn].textContent.trim();
  if (login) return `login == ${filterStringLiteral(login)}`;

  // Последний резервный вариант для очень старой таблицы без ссылки и логина.
  // Имя может быть не уникальным, поэтому он используется только при отсутствии
  // более точного идентификатора.
  const nameColumn = normalizedHeaders.findIndex(header =>
    /^(user name|user|author|name)$/.test(header)
  );
  const name = nameColumn < 0 ? '' : runTr.cells[nameColumn].textContent.trim();
  if (name) return `name == ${filterStringLiteral(name)}`;

  // У старых версий ejudge ссылка именно на имя иногда содержит filter_expr.
  // Не берём filter_expr из всей строки раньше: ссылки Source/Report тоже
  // несут текущий общий фильтр (например, name~="Кут" && prob>="O").
  const authorColumn = normalizedHeaders.findIndex(header =>
    /^(user name|user|author|name)$/.test(header)
  );
  const authorLinks = authorColumn < 0 ? [] :
    Array.from(runTr.cells[authorColumn].querySelectorAll('a[href]'));
  for (const link of authorLinks) {
    const filterExpression = new URL(link.href, window.location.href).searchParams.get('filter_expr');
    if (filterExpression) return filterExpression;
  }
  return null;
}

function getSessionId() {
  const fromUrl = new URL(window.location.href).searchParams.get('SID');
  if (fromUrl) return fromUrl;
  const hidden = document.querySelector('input[name="SID"]');
  if (hidden && hidden.value) return hidden.value;
  const link = Array.from(document.querySelectorAll('a[href*="SID="]'))
    .map(element => new URL(element.href, window.location.href).searchParams.get('SID'))
    .find(Boolean);
  return link || null;
}

function makeEjudgeUrl(pathname, parameters = {}) {
  const current = new URL(window.location.href);
  const url = new URL(pathname, current.origin);
  // При входе по contest_id/role SID может отсутствовать в адресной строке.
  // Оставляем оба варианта контекста: сервер выберет подходящий.
  for (const name of ['SID', 'contest_id', 'locale_id', 'role']) {
    const value = current.searchParams.get(name);
    if (value) url.searchParams.set(name, value);
  }
  const sessionId = getSessionId();
  if (sessionId) url.searchParams.set('SID', sessionId);
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }
  return url;
}

function makeMasterUrl(filterExpression) {
  const current = new URL(window.location.href);
  const url = makeEjudgeUrl('/cgi-bin/new-master');
  // Сохраняем дополнительные параметры конкретной установки ejudge, но не
  // переносим действие, номер посылки или прежний фильтр.
  for (const [name, value] of current.searchParams) {
    if (/^(SID|contest_id|locale_id|role|action|action_\d+|run_id|filter_expr|filter_view|filter_first_run|filter_last_run)$/.test(name)) continue;
    url.searchParams.set(name, value);
  }
  url.searchParams.set('filter_expr', filterExpression);
  return url;
}

function getRunSourceUrl(runTr, runId) {
  const sourceLink = Array.from(runTr.querySelectorAll('a[href]'))
    .map(link => new URL(link.href, window.location.href))
    .find(url => url.searchParams.get('run_id') === String(runId) &&
      url.searchParams.get('action') === '91');
  return sourceLink ? sourceLink.href :
    makeEjudgeUrl('/cgi-bin/new-judge', {action: '91', run_id: runId}).href;
}

function isLoginPage(text) {
  return /<title>[^<]*login page<\/title>/i.test(text) ||
    (/<input[^>]+name=["']login["']/i.test(text) && /<input[^>]+name=["']password["']/i.test(text));
}

// Фильтры ejudge сохраняются на сервере в сессии: запросы истории и
// восстановление исходного фильтра нельзя выполнять вперемешку.
let runsFilterQueue = Promise.resolve();

function fetchUserRunsPage(filterExpression) {
  const task = runsFilterQueue.then(() => fetchUserRunsPageSerial(filterExpression));
  runsFilterQueue = task.catch(() => {});
  return task;
}

async function fetchUserRunsPageSerial(filterExpression) {
  // Ссылка на имя в таблице ведёт в карточку ученика, а не к его посылкам.
  // Фильтр uid показывает все посылки только этого ученика.
  const filterInput = document.querySelector('input[name="filter_expr"]');
  const savedFilter = filterInput ? filterInput.value : null;
  const firstInput = document.querySelector('[name="filter_first_run"], [name="first_run"]');
  const lastInput = document.querySelector('[name="filter_last_run"], [name="last_run"]');
  const params = new URL(window.location.href).searchParams;
  // Пустое значение — допустимое исходное состояние. Восстанавливаем его
  // явно, поскольку простое отсутствие параметра может оставить настройки
  // предыдущего служебного запроса в сессии.
  const savedFirst = firstInput ? firstInput.value : (params.get('filter_first_run') ?? params.get('first_run') ?? '');
  const savedLast = lastInput ? lastInput.value : (params.get('filter_last_run') ?? params.get('last_run') ?? '');
  if (savedFilter === null) {
    return {page: null, reason: 'не удалось сохранить исходный фильтр; служебный поиск не выполнен'};
  }
  const url = makeMasterUrl(filterExpression);
  url.searchParams.set('filter_first_run', '0');
  url.searchParams.set('filter_last_run', '-1');
  url.searchParams.set('filter_view', '1');
  try {
    const response = await fetch(url);
    if (!response.ok) return {page: null, reason: `сервер вернул HTTP ${response.status}`};
    const page = await response.text();
    return isLoginPage(page) ? {page: null, reason: 'ejudge запросил повторный вход'} : {page, reason: null};
  } finally {
    // ejudge хранит текущий фильтр в сессии. Возвращаем тот, который был у
    // проверяющего, чтобы обновление страницы не переключило его таблицу.
    const resetUrl = makeEjudgeUrl('/cgi-bin/new-master', {action_65: 'Reset filter'});
    const restoreUrl = makeMasterUrl(savedFilter);
    restoreUrl.searchParams.set('filter_first_run', savedFirst);
    restoreUrl.searchParams.set('filter_last_run', savedLast);
    restoreUrl.searchParams.set('filter_view', '1');
    try {
      const resetResponse = await fetch(resetUrl);
      if (!resetResponse.ok || isLoginPage(await resetResponse.text())) {
        throw new Error(`сброс фильтра: HTTP ${resetResponse.status} или требуется повторный вход`);
      }
      const response = await fetch(restoreUrl);
      if (!response.ok || isLoginPage(await response.text())) {
        throw new Error(`HTTP ${response.status} или требуется повторный вход`);
      }
    } catch (error) {
      throw new Error(`Не удалось восстановить фильтр и границы списка ejudge: ${error.message}. Проверь First run и Last run`);
    }
  }
}

function findRunsTableInDocument(pageDocument) {
  const runIdHeader = Array.from(pageDocument.querySelectorAll('th'))
    .find(el => el.textContent.trim() === 'Run ID');
  return runIdHeader ? runIdHeader.closest('table') : null;
}

function findPreviousSuccessfulRun(pageDocument, problemCode, currentRunId, authorFilter = null) {
  const runsTable = findRunsTableInDocument(pageDocument);
  if (!runsTable) return null;
  const headers = Array.from(runsTable.rows[0].cells).map(cell => cell.textContent.trim());
  const runIdColumn = headers.indexOf('Run ID');
  const problemColumn = headers.indexOf('Problem');
  const resultColumn = headers.indexOf('Result');
  if (runIdColumn < 0 || problemColumn < 0 || resultColumn < 0) return null;

  return Array.from(runsTable.rows).slice(1)
    .filter(row => row.cells.length > Math.max(runIdColumn, problemColumn, resultColumn))
    .filter(row => !authorFilter || getAuthorFilterExpression(row, headers) === authorFilter)
    .filter(row => getProblemCode(row.cells[problemColumn].textContent) === problemCode)
    .filter(row => /^(OK|Accepted|Pending\s+review|Rejected|PR|RJ)$/i.test(row.cells[resultColumn].textContent.trim()))
    .map(row => ({
      runId: Number(row.cells[runIdColumn].textContent.trim()),
      language: headers.indexOf('Language') >= 0 ? row.cells[headers.indexOf('Language')].textContent.trim() : 'python3',
      sourceUrl: getRunSourceUrl(row, row.cells[runIdColumn].textContent.trim()),
    }))
    .filter(run => Number.isSafeInteger(run.runId) && run.runId >= 0 && run.runId < currentRunId)
    .sort((a, b) => b.runId - a.runId)[0] || null;
}

function hasLongClass(code) {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  for (let start = 0; start < lines.length; start++) {
    const declaration = lines[start].match(/^(\s*)class\s+[A-Za-z_]\w*(?:\s*\([^)]*\))?\s*:/);
    if (!declaration) continue;
    const indentation = declaration[1].length;
    let end = start + 1;
    while (end < lines.length) {
      const line = lines[end];
      if (line.trim().length > 0 && line.match(/^\s*/)[0].length <= indentation) break;
      end++;
    }
    if (end - start > 50) return true;
  }
  return false;
}

// Алгоритм Майерса: быстр, когда в большом классе изменили только пару методов.
function makeLineDiff(oldLines, newLines, maxEdits = 1500) {
  const n = oldLines.length;
  const m = newLines.length;
  const max = Math.min(n + m, maxEdits);
  let previous = new Map([[1, 0]]);
  const trace = [];

  for (let distance = 0; distance <= max; distance++) {
    const current = new Map();
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      let x;
      if (diagonal === -distance ||
          (diagonal !== distance && (previous.get(diagonal - 1) ?? -Infinity) < (previous.get(diagonal + 1) ?? -Infinity))) {
        x = previous.get(diagonal + 1) ?? 0;
      } else {
        x = (previous.get(diagonal - 1) ?? 0) + 1;
      }
      let y = x - diagonal;
      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }
      current.set(diagonal, x);
      if (x >= n && y >= m) {
        trace.push(current);
        return backtrackLineDiff(trace, oldLines, newLines);
      }
    }
    trace.push(current);
    previous = current;
  }
  return null;
}

function backtrackLineDiff(trace, oldLines, newLines) {
  let x = oldLines.length;
  let y = newLines.length;
  const result = [];
  for (let distance = trace.length - 1; distance > 0; distance--) {
    const previous = trace[distance - 1];
    const diagonal = x - y;
    const previousDiagonal = diagonal === -distance ||
      (diagonal !== distance && (previous.get(diagonal - 1) ?? -Infinity) < (previous.get(diagonal + 1) ?? -Infinity))
        ? diagonal + 1
        : diagonal - 1;
    const previousX = previous.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;
    while (x > previousX && y > previousY) {
      result.push({kind: 'same', text: oldLines[--x]});
      y--;
    }
    if (x === previousX) result.push({kind: 'add', text: newLines[--y]});
    else result.push({kind: 'remove', text: oldLines[--x]});
  }
  while (x > 0 && y > 0) {
    result.push({kind: 'same', text: oldLines[--x]});
    y--;
  }
  while (x > 0) result.push({kind: 'remove', text: oldLines[--x]});
  while (y > 0) result.push({kind: 'add', text: newLines[--y]});
  return result.reverse();
}

const ejudge2hljs = {
  'gcc': 'c',
  'g++': 'cpp',
  'javac': 'java',
  'mcs': 'csharp',
  'ruby': 'ruby',
  'php': 'php',
  'python3': 'python',
  'gccgo': 'go',
  'pasabc-linux': 'delphi',
  'rust': 'rust',
  'kotlin': 'kotlin',
  'node': 'javascript',
};


function renderFullSolution(solTd, code, language) {
  const pre = document.createElement('pre');
  pre.classList.add('hljs');
  const lang = ejudge2hljs[language] || 'python';
  pre.innerHTML = hljs.highlight(code, {language: lang, ignoreIllegals: true}).value;
  pre.style = "overflow-x: auto; overflow-y: hidden; max-width: 50vw; border-left: 4px solid #005282; padding-left: 7px; margin-top: -2px;";
  solTd.innerText = '';
  solTd.appendChild(pre);
}

// Подсвечиваем весь исходник, чтобы многострочные конструкции не теряли контекст.
function highlightedLines(code, language) {
  const lang = ejudge2hljs[language] || 'python';
  const html = hljs.highlight(code, {language: lang, ignoreIllegals: true}).value;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const lines = [document.createDocumentFragment()];
  function visit(node, classes) {
    if (node.nodeType === 3) {
      const parts = node.nodeValue.split('\n');
      parts.forEach((part, index) => {
        if (index) lines.push(document.createDocumentFragment());
        if (!part) return;
        let target = lines[lines.length - 1];
        for (const className of classes) {
          const span = document.createElement('span');
          span.className = className;
          target.appendChild(span);
          target = span;
        }
        target.appendChild(document.createTextNode(part));
      });
    } else if (node.nodeType === 1) {
      const next = node.className ? [...classes, node.className] : classes;
      for (const child of node.childNodes) visit(child, next);
    }
  }
  for (const child of parsed.body.childNodes) visit(child, []);
  return lines;
}

function renderLine(solTd, prefix, text, color) {
  const line = document.createElement('div');
  line.style = `white-space: pre; padding: 0 0.4rem; background: ${color};`;
  line.textContent = prefix + text;
  solTd.appendChild(line);
}

function renderDiff(solTd, diff, previousRun, previousProblem, oldCode, newCode, language) {
  solTd.innerText = '';
  solTd.style = 'max-width: 50vw;';
  const title = document.createElement('div');
  title.style = 'font-family: sans-serif; font-size: 0.85em; color: #666; margin: 0.1rem 0 0.35rem;';
  title.textContent = `Изменения относительно посылки ${previousRun.runId} по задаче ${previousProblem}:`;
  solTd.appendChild(title);

  const scrollArea = document.createElement('div');
  scrollArea.style = 'max-width: 50vw; overflow-x: auto;';
  solTd.appendChild(scrollArea);
  const diffBody = document.createElement('div');
  diffBody.classList.add('hljs');
  diffBody.style = 'border-left: 4px solid #005282; font-family: monospace; padding: 0; width: max-content; min-width: 100%; box-sizing: border-box;';
  scrollArea.appendChild(diffBody);
  const visible = new Set();
  diff.forEach((entry, index) => {
    if (entry.kind === 'same') return;
    for (let context = Math.max(0, index - 2); context <= Math.min(diff.length - 1, index + 2); context++) visible.add(context);
  });
  let oldHighlighted, newHighlighted;
  try {
    oldHighlighted = highlightedLines(oldCode, language);
    newHighlighted = highlightedLines(newCode, language);
  } catch (error) {
    console.warn('Не удалось подсветить diff:', error);
  }
  let oldIndex = 0, newIndex = 0;
  let skipped = 0;
  diff.forEach((entry, index) => {
    const oldLine = entry.kind !== 'add' ? oldIndex++ : -1;
    const newLine = entry.kind !== 'remove' ? newIndex++ : -1;
    if (!visible.has(index)) {
      skipped++;
      return;
    }
    if (skipped > 0) {
      renderLine(diffBody, '… ', `${skipped} неизменённых строк`, '#f6f8fa');
      skipped = 0;
    }
    const style = entry.kind === 'add' ? ['+ ', '#e6ffed'] :
      entry.kind === 'remove' ? ['- ', '#ffebe9'] : ['  ', 'transparent'];
    const line = document.createElement('div');
    line.style = `white-space: pre; padding: 0 0.4rem; background: ${style[1]};`;
    line.appendChild(document.createTextNode(style[0]));
    const highlighted = entry.kind === 'remove' ? oldHighlighted?.[oldLine] : newHighlighted?.[newLine];
    line.appendChild(highlighted || document.createTextNode(entry.text));
    diffBody.appendChild(line);
  });
  if (skipped > 0) renderLine(diffBody, '… ', `${skipped} неизменённых строк`, '#f6f8fa');
}

function makeHistoryGroups(runs) {
  const authors = new Map();
  const problems = new Map();
  for (const run of runs) {
    const author = run.authorFilter;
    const problem = getPreviousProblemCode(run.Problem);
    if (!author || !problem) continue;
    if (!authors.has(author)) authors.set(author, []);
    if (!problems.has(problem)) problems.set(problem, []);
    authors.get(author).push(run);
    problems.get(problem).push(run);
  }
  const byProblem = problems.size <= authors.size;
  const groups = byProblem ? problems : authors;
  const sourceCache = new Map();
  for (const [key, members] of groups) {
    let pending = null;
    const filter = `${byProblem ? `prob == ${filterStringLiteral(key)}` : `(${key})`} && (status == OK || status == PR || status == RJ)`;
    const group = {
      sourceCache,
      getPage() {
        if (!pending) pending = fetchUserRunsPage(filter).then(response => {
          if (!response.page) return {document: null, reason: response.reason};
          const parsed = new DOMParser().parseFromString(response.page, 'text/html');
          if (!findRunsTableInDocument(parsed)) return {document: null, reason: 'ejudge не вернул таблицу посылок'};
          return {document: parsed, reason: null};
        });
        return pending;
      },
    };
    for (const member of members) member.historyGroup = group;
  }
}

async function getPreviousSolution(thisRun) {
  const previousProblem = getPreviousProblemCode(thisRun['Problem']);
  const authorFilter = thisRun['authorFilter'];
  if (!previousProblem) return {previous: null, reason: 'для этой задачи нет предыдущей задачи'};
  if (!authorFilter) return {previous: null, reason: 'в строке посылки не найден идентификатор ученика'};
  const currentRunId = Number(thisRun['Run ID']);
  if (!Number.isSafeInteger(currentRunId) || currentRunId < 0) return {previous: null, reason: 'не удалось определить номер текущей посылки'};
  const group = thisRun.historyGroup;
  if (!group) return {previous: null, reason: 'не удалось подготовить поиск истории'};
  const response = await group.getPage();
  if (!response.document) return {previous: null, reason: response.reason};
  const previousRun = findPreviousSuccessfulRun(response.document, previousProblem, currentRunId, authorFilter);
  if (!previousRun) return {previous: null, reason: `до этой посылки по задаче ${previousProblem} не найдено OK, PR или RJ`};
  if (!group.sourceCache.has(previousRun.runId)) group.sourceCache.set(previousRun.runId, fetch(previousRun.sourceUrl).then(async sourceResponse => {
    if (!sourceResponse.ok) throw new Error(`не удалось получить посылку ${previousRun.runId}`);
    return sourceResponse.text();
  }));
  let code;
  try { code = await group.sourceCache.get(previousRun.runId); }
  catch (error) { group.sourceCache.delete(previousRun.runId); return {previous: null, reason: error.message}; }
  if (isLoginPage(code)) return {previous: null, reason: 'ejudge запросил повторный вход при чтении предыдущей посылки'};
  return {previous: {code, run: previousRun, problem: previousProblem}, reason: null};
}

function renderDiffFallback(solTd, code, language, reason) {
  renderFullSolution(solTd, code, language);
  const note = document.createElement('div');
  note.style = 'font-family: sans-serif; font-size: 0.85em; color: #666; margin: 0.1rem 0 0.35rem;';
  note.textContent = `Разность не показана: ${reason}.`;
  solTd.insertBefore(note, solTd.firstChild);
}

function processSolutionTd(solTd, thisRun) {
  solTd.innerText = 'loading...';
  fetch(thisRun['sourceUrl'])
    .then(async response => {
      if (!response.ok) throw new Error(`Не удалось загрузить исходник: HTTP ${response.status}`);
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        const imageUrl = URL.createObjectURL(await response.blob());
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.display = 'block';
        img.onload = img.onerror = () => URL.revokeObjectURL(imageUrl);
        solTd.innerText = '';
        solTd.appendChild(img);
        return null;
      }
      const code = await response.text();
      if (isLoginPage(code)) throw new Error('ejudge запросил повторный вход при чтении исходника');
      return code;
    })
    .then(async code => {
      if (code === null) return; // Изображение уже показано.
      if (hasLongClass(code)) {
        let previousResult;
        try {
          previousResult = await getPreviousSolution(thisRun);
        } catch (error) {
          renderDiffFallback(solTd, code, thisRun['Language'], error.message);
          return;
        }
        const previous = previousResult.previous;
        if (previous) {
          const diff = makeLineDiff(
            previous.code.replace(/\r\n?/g, '\n').split('\n'),
            code.replace(/\r\n?/g, '\n').split('\n'),
          );
          if (diff) {
            renderDiff(solTd, diff, previous.run, previous.problem,
              previous.code.replace(/\r\n?/g, '\n'), code.replace(/\r\n?/g, '\n'), thisRun['Language']);
            return;
          }
          renderDiffFallback(solTd, code, thisRun['Language'], 'слишком большая разность');
          return;
        }
        renderDiffFallback(solTd, code, thisRun['Language'], previousResult.reason);
        return;
      }
      renderFullSolution(solTd, code, thisRun['Language']);
    })
    .catch(error => solTd.innerText = error.toString());
}

function getListOfProblemNames() {
  const probToName = new Map();
  Array.from(document.getElementsByName("problem")[0].options).map(el => {
    const m = el.innerText.match(/^(\w+) - (.*)$/);
    probToName.set(m[1], m[2]);
  });
  return probToName;
}

function processCommentAreaTd(comTd) {
  comTd.style = "max-width: 30%; width: 25rem;";
  const commentArea = document.createElement("textarea");
  commentArea.style = "width: 100%";
  commentArea.rows = 7;
  comTd.appendChild(commentArea);
  return commentArea;
}


// На странице просмотра посылки ejudge показывает встроенные в задачу
// комментарии в блоке "Review comments". На странице со списком посылок их
// нет, но ссылка View уже ведёт на эту страницу, поэтому можно получить блок
// отдельным GET-запросом.
function getReviewPageUrls(runTr, runId) {
  return Array.from(runTr.querySelectorAll('a[href]'))
    .map(link => new URL(link.href, window.location.href))
    .filter(url => url.searchParams.get('run_id') === String(runId))
    // action=91 — это исходный текст посылки, а не страница review.
    .filter(url => !(url.pathname.endsWith('/new-judge') && url.searchParams.get('action') === '91'))
    .map(url => url.href);
}

function textWithoutControls(element) {
  const copy = element.cloneNode(true);
  copy.querySelectorAll('button, input, select, textarea, script, style').forEach(el => el.remove());
  copy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  return copy.textContent
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findHeading(reviewDocument, title) {
  return Array.from(reviewDocument.querySelectorAll('h1, h2, h3, h4'))
    .find(el => el.textContent.trim().toLowerCase() === title.toLowerCase());
}

function extractReviewComments(reviewDocument) {
  const heading = findHeading(reviewDocument, 'review comments');
  if (!heading) return [];

  const comments = [];
  // В разных версиях ejudge комментарии могут лежать либо прямо после h2,
  // либо в таблице. Ищем у каждого (+) его ближайшую строку/контейнер.
  let element = heading.nextElementSibling;
  while (element && !/^H[1-4]$/.test(element.tagName)) {
    const controls = element.matches('button, input') ? [element] :
      Array.from(element.querySelectorAll('button, input'));
    for (const control of controls) {
      const label = (control.value || control.textContent || '').trim();
      if (!label.includes('+')) continue;
      const container = control.closest('tr') || control.parentElement;
      const text = textWithoutControls(container);
      if (text) comments.push(text);
    }
    element = element.nextElementSibling;
  }
  return [...new Set(comments)];
}

function extractPreviousRunComments(reviewDocument) {
  // "Run comments for previous runs" в ejudge — зелёная строка интерфейса,
  // а не h2. Надёжнее найти заголовок именно нужной колонки таблицы.
  const commentHeader = Array.from(reviewDocument.querySelectorAll('th, td'))
    .find(el => el.textContent.trim().toLowerCase() === 'run comment');
  if (!commentHeader) return [];

  const table = commentHeader.closest('table');
  const headerRow = commentHeader.closest('tr');
  if (!table || !headerRow) return [];

  const commentColumn = Array.from(headerRow.cells).indexOf(commentHeader);
  const headerRowIndex = Array.from(table.rows).indexOf(headerRow);
  return Array.from(table.rows).slice(headerRowIndex + 1)
    .filter(row => row.cells.length > commentColumn)
    .map(row => ({
      author: textWithoutControls(row.cells[0]).split('\n')[0],
      text: textWithoutControls(row.cells[commentColumn]),
    }))
    .filter(comment => comment.text.length > 0);
}

function appendComment(commentArea, text) {
  const prefix = commentArea.value.trim().length === 0 ? '' : '\n';
  commentArea.value += prefix + text;
  commentArea.focus();
  // Нужно для обработчиков, которые могут быть добавлены другими расширениями.
  commentArea.dispatchEvent(new Event('input', {bubbles: true}));
}

function renderReviewComments(commentsTd, commentArea, comments) {
  if (comments.length === 0) return;
  for (const text of comments) {
    const line = document.createElement('div');
    line.style = 'margin-top: 0.15rem;';

    const button = document.createElement('button');
    button.type = 'button';
    button.innerText = '(+)';
    button.title = 'Добавить этот комментарий в поле review';
    button.onclick = () => appendComment(commentArea, text);
    line.appendChild(button);

    const label = document.createElement('span');
    // textContent не превращает \n в <br>, как innerText.
    label.textContent = ' ' + text.replace(/\s*\n\s*/g, ' ') + ' ';
    line.appendChild(label);

    commentsTd.appendChild(line);
  }
}

function renderPreviousRunComments(commentsTd, comments) {
  if (comments.length === 0) return;

  const history = document.createElement('div');
  history.style = 'margin-top: 0.75rem;';
  const title = document.createElement('strong');
  title.textContent = 'Ранее полученные комментарии:';
  history.appendChild(title);

  for (const comment of comments) {
    const item = document.createElement('div');
    item.style = 'margin-top: 0.25rem; padding-left: 0.55rem; border-left: 2px solid #ccc; white-space: pre-wrap;';
    const author = document.createElement('strong');
    author.textContent = comment.author ? comment.author + ': ' : '';
    item.appendChild(author);
    item.appendChild(document.createTextNode(comment.text));
    history.appendChild(item);
  }
  commentsTd.appendChild(history);
}

async function loadReviewComments(commentsTd, runTr, runId, commentArea) {
  const urls = getReviewPageUrls(runTr, runId);
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const reviewDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
      const comments = extractReviewComments(reviewDocument);
      const previousComments = extractPreviousRunComments(reviewDocument);
      if (comments.length > 0 || previousComments.length > 0) {
        commentsTd.innerText = '';
        renderReviewComments(commentsTd, commentArea, comments);
        renderPreviousRunComments(commentsTd, previousComments);
        return;
      }
    } catch (error) {
      console.warn('Не удалось загрузить встроенные комментарии ejudge', error);
    }
  }
  commentsTd.parentElement.remove();
}


function fetchEjudge(SID, run_id, action, msg_text = null) {
  // action_241: Just OK the run
  // action_237: Send run comment and OK run
  // action_238: Send run comment and REJECT run
  // action_242: Just SUMMON the run
  let details;
  if (action === 'OK') {
    details = {
      SID,
      run_id,
    };
    if (msg_text) {
      if (!msg_text || msg_text.trim().length === 0) {
        return new Promise((resolve, reject) => reject('Нет сообщения'));
      }
      details['msg_text'] = msg_text;
      details['action_237'] = 'Send run comment and OK run';
    } else {
      details['action_241'] = 'Just OK the run';
    }
  } else if (action === 'REJECT') {
    if (!msg_text || msg_text.trim().length === 0) {
      return new Promise((resolve, reject) => reject('Нет сообщения'));
    }
    details = {
      SID,
      msg_text,
      run_id,
      'action_238': 'Send run comment and REJECT run',
    };
  } else if (action === 'DISQUALIFY') {
    details = {
      SID,
      run_id,
      'action': 67, // disqualify or may be set this status...
      'status': 10, // ???
    };
  } else if (action === 'SUMMON') {
    details = {
      SID,
      run_id,
      'action_242': 'Just SUMMON the run',
    };
  } else {
    throw `Wrong action ${action}`;
  }
  const formBody = Object.entries(details).map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&');
  return fetch(`/cgi-bin/new-master`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
    body: formBody,
    // referrerPolicy: "strict-origin-when-cross-origin",
    // mode: "cors",
    // credentials: "include",
  });
}

function processButtonsTd(butTd, run_id, commentArea, SID, runTr) {
  butTd.style = "width: 10%";
  for (const butObj of [
    {text: "Just OK", onclick: () => fetchEjudge(SID, run_id, 'OK')},
    {text: "Comment&OK", onclick: () => fetchEjudge(SID, run_id, 'OK', commentArea.value)},
    {text: "Reject", onclick: () => fetchEjudge(SID, run_id, 'REJECT', commentArea.value)},
    {text: "DQ", onclick: () => fetchEjudge(SID, run_id, 'DISQUALIFY')},
    {text: "Just SUMMON", onclick: () => fetchEjudge(SID, run_id, 'SUMMON')},
    {text: "★★★", onclick: () => fetchEjudge(SID, run_id, 'OK', '★★★ 😄')},
    {text: "★★", onclick: () => fetchEjudge(SID, run_id, 'OK', '★★ 🙂')},
    {text: "★", onclick: () => fetchEjudge(SID, run_id, 'OK', '★ 🤢')},
  ]) {
    const newBut = document.createElement("button");
    newBut.innerText = butObj.text;
    newBut.onclick = () => {
      Array.from(butTd.children).forEach(but => but.style.background = "");
      newBut.style.background = "#FFFACD";
      butObj.onclick()
            .then(response => {
              newBut.style.background = "#4CAF50";
            })
            .catch(error => {
              console.error(error);
              newBut.style.background = "#f44336";
              newBut.title = String(error);
            });
    };
    butTd.appendChild(newBut);
  }
}

function addTableOfRuns(runsTable, addAfterElement) {
  const runsToAdd = parseRunsTable(runsTable);
  makeHistoryGroups(runsToAdd);
  const SID = getSessionId();
  // Создаём таблицу решений
  const solsTable = document.createElement('table');
  solsTable.style = "width: 100%; border-collapse: collapse;";
  for (const thisRun of runsToAdd) {
    // Создаём строчку с копией строчки из таблицы посылок
    const rowHd = document.createElement("tr");
    const joined = document.createElement("td");
    joined.colSpan = 3;
    joined.appendChild(thisRun['tr']);
    rowHd.appendChild(joined);
    solsTable.appendChild(rowHd);
    // Создаём строчку с элементами управления
    const rowWithCode = document.createElement("tr");
    rowWithCode.style = "vertical-align: top;";
    const solTd = document.createElement("td");
    processSolutionTd(solTd, thisRun);
    const comTd = document.createElement("td");
    const commentArea = processCommentAreaTd(comTd);
    const butTd = document.createElement("td");
    processButtonsTd(butTd, thisRun["Run ID"], commentArea, SID, thisRun['tr']);
    [comTd, butTd, solTd].forEach(el => rowWithCode.appendChild(el));
    solsTable.appendChild(rowWithCode);

    // Эту строку удаляем после загрузки, если у задачи нет шаблонов review.
    const commentsRow = document.createElement('tr');
    const commentsTd = document.createElement('td');
    commentsTd.colSpan = 3;
    commentsTd.style = 'padding: 0.15rem 0 0.6rem; border-bottom: 1pt solid #005282;';
    commentsTd.innerText = 'Загрузка встроенных комментариев…';
    commentsRow.appendChild(commentsTd);
    solsTable.appendChild(commentsRow);
    loadReviewComments(commentsTd, thisRun['tr'], thisRun['Run ID'], commentArea);
  }
  runsTable.parentNode.insertBefore(solsTable, runsTable.nextSibling);
}


function addShowSourcesButton() {
  const table = findRunsTable();
  if (table) {
    const showSourcesButton = document.createElement('input');
    showSourcesButton.type = "submit";
    showSourcesButton.name = "showSourcesButton";
    showSourcesButton.value = "Load and show solutions";
    showSourcesButton.onclick = () => addTableOfRuns(table, table);
    table.parentNode.insertBefore(showSourcesButton, table.nextSibling);
  }
}


//removeTrash();
makeTablesSortable();
// highlightCode();
addShowSourcesButton();
