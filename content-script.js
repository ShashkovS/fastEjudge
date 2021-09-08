// browser://extensions/

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
    pre.innerHTML = hljs.highlight('python', text).value;
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
    const problemCell = thisRun['tr'].cells[colNums["Problem"]];
    // Заменяем короткое название на длинное
    problemCell.innerText = problemCell.innerText + ' - ' + (probToName.get(problemCell.innerText.replace(/-\d+$/, '')) || '');
    runsToAdd.push(thisRun);
    // https://server.179.ru/cgi-bin/new-judge?SID=10a2e6abb4590c55&action=91&run_id=787
  }
  return runsToAdd;
}

function processSolutionTd(solTd, thisRun, SID) {
  solTd.innerText = 'loading...';
  solTd.style = "width: 50%";
  fetch(`/cgi-bin/new-judge?SID=${SID}&action=91&run_id=${thisRun["Run ID"]}`)
    .then(response => response.text())
    .then(code => {
      const pre = document.createElement('pre');
      const lang = thisRun["Language"].toLowerCase().charAt(0) === 'c' ? 'c++' : 'python';
      pre.innerHTML = hljs.highlight(lang, code).value;
      // pre.style = "font-size:150%";
      solTd.innerText = '';
      solTd.appendChild(pre);
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
  comTd.style = "width: 40%";
  const commentArea = document.createElement("textarea");
  commentArea.style = "width: 100%";
  commentArea.rows = 7;
  comTd.appendChild(commentArea);
  return commentArea;
}


function fetchEjudge(SID, run_id, action, msg_text = null) {
  // action_241: Just OK the run
  // action_237: Send run comment and OK run
  // action_238: Send run comment and REJECT run
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

function processButtonsTd(butTd, run_id, commentArea, SID) {
  butTd.style = "width: 10%";
  for (const butObj of [
    {text: "Just OK", onclick: () => fetchEjudge(SID, run_id, 'OK')},
    {text: "Comment&OK", onclick: () => fetchEjudge(SID, run_id, 'OK', commentArea.value)},
    {text: "Reject", onclick: () => fetchEjudge(SID, run_id, 'REJECT', commentArea.value)},
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
            });
    };
    butTd.appendChild(newBut);
  }
}

function addTableOfRuns(runsTable, addAfterElement) {
  const runsToAdd = parseRunsTable(runsTable);
  const SID = window.location.href.match(/SID=(\w+)/)[1];
  // Создаём таблицу решений
  const solsTable = document.createElement('table');
  solsTable.style = "width: 100%";
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
    const solTd = document.createElement("td");
    processSolutionTd(solTd, thisRun, SID);
    const comTd = document.createElement("td");
    const commentArea = processCommentAreaTd(comTd);
    const butTd = document.createElement("td");
    processButtonsTd(butTd, thisRun["Run ID"], commentArea, SID);
    [solTd, comTd, butTd].forEach(el => rowWithCode.appendChild(el));
    solsTable.appendChild(rowWithCode);
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
