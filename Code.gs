/**
 * Mission Mode — Google Apps Script backend
 * MVP: Gmail + Google Calendar + persistent tasks + Plan → Act → Verify → Recover.
 *
 * Deploy as a web app executing as the user accessing it, and restrict access
 * to yourself / trusted users. Never publish this app to anyone with the URL.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Mission Mode')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getDashboardData() {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const result = {
    user: safeGetUserEmail_(), appUrl: getTaskFlowWebAppUrl_(), emails: [], emailSummary: '',
    emailPeriod: { start: formatDateInput_(defaultFrom), end: formatDateInput_(now) },
    emailTotal: 0, events: [], tasks: [], emailStatus: 'connected',
    calendarStatus: 'connected', generatedAt: new Date().toISOString()
  };
  try {
    result.tasks = getTasks();
  } catch (e) {
    result.taskError = friendlyError_(e);
    result.tasks = [];
  }
  try {
    const mailData = getEmailsForPeriod(result.emailPeriod.start, result.emailPeriod.end, 100);
    result.emails = mailData.emails; result.emailSummary = mailData.summary;
    result.emailTotal = mailData.total; result.emailTruncated = mailData.truncated;
  } catch (e) {
    result.emailStatus = 'permission_required_or_unavailable'; result.emailError = friendlyError_(e);
  }
  try {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    result.events = CalendarApp.getDefaultCalendar().getEvents(start, end).slice(0, 8).map(function(ev) {
      return { id: ev.getId(), title: ev.getTitle(), start: ev.getStartTime().toISOString(),
        end: ev.getEndTime().toISOString(), location: ev.getLocation() || '' };
    });
  } catch (e) {
    result.calendarStatus = 'permission_required_or_unavailable'; result.calendarError = friendlyError_(e);
  }
  return result;
}

/** Date-filtered Gmail metadata/snippet digest; does not send email content to an external AI. */
function getEmailsForPeriod(startDate, endDate, maxResults) {
  const start = parseDateInput_(startDate, 'Start date');
  const end = parseDateInput_(endDate, 'End date');
  if (start.getTime() > end.getTime()) throw new Error('Start date must be on or before end date.');
  const exclusiveEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  const query = 'in:anywhere after:' + formatGmailDate_(start) +
    ' before:' + formatGmailDate_(exclusiveEnd) + ' -in:spam -in:trash';
  const limit = Math.min(Math.max(Number(maxResults) || 100, 1), 100);
  const threads = GmailApp.search(query, 0, limit);
  const emails = [];
  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    const matching = messages.filter(function(msg) {
      const d = msg.getDate(); return d >= start && d < exclusiveEnd;
    });
    const msg = matching.length ? matching[matching.length - 1] : messages[messages.length - 1];
    if (!msg) return;
    const d = msg.getDate();
    if (d < start || d >= exclusiveEnd) return;
    emails.push({ id: thread.getId(), subject: msg.getSubject() || '(No subject)',
      sender: msg.getFrom() || 'Unknown sender', date: d.toISOString(),
      snippet: trimText_(msg.getPlainBody(), 220), unread: thread.isUnread(),
      messageCountInRange: matching.length });
  });
  emails.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  const total = emails.length;
  const dateLabel = Utilities.formatDate(start, Session.getScriptTimeZone(), 'dd MMM yyyy') +
    ' – ' + Utilities.formatDate(end, Session.getScriptTimeZone(), 'dd MMM yyyy');
  const unreadCount = emails.filter(function(e) { return e.unread; }).length;
  const senders = {};
  emails.forEach(function(e) { senders[e.sender] = (senders[e.sender] || 0) + 1; });
  const topSenders = Object.keys(senders).sort(function(a,b) { return senders[b] - senders[a]; })
    .slice(0, 3).map(function(s) { return s + ' (' + senders[s] + ')'; });
  const summary = total
    ? 'Email digest for ' + dateLabel + ': ' + total + ' conversation(s), ' + unreadCount +
      ' unread. Frequent sender(s): ' + (topSenders.join(', ') || 'not available') +
      '. Each result includes its date and time. This is a metadata/snippet digest, not an AI-generated interpretation.'
    : 'No email conversations found for ' + dateLabel + '. Try widening the date range or checking the Google account.';
  return { emails: emails, total: total, summary: summary, truncated: threads.length >= limit,
    startDate: startDate, endDate: endDate };
}
function parseDateInput_(value, label) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(label + ' is required.');
  const parts = s.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (d.getFullYear() !== parts[0] || d.getMonth() !== parts[1] - 1 || d.getDate() !== parts[2])
    throw new Error(label + ' is invalid.');
  return d;
}
function formatDateInput_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function formatGmailDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
}

/** Return server-authoritative account links for the profile menu.
 * ScriptApp.getService().getUrl() returns the deployed web app URL (/exec), unlike the
 * temporary script.googleusercontent.com iframe URL seen by browser JavaScript.
 */
function getAccountMenuData() {
  return {
    email: safeGetUserEmail_(),
    appUrl: getTaskFlowWebAppUrl_(),
    accountChooserUrl: 'https://accounts.google.com/AccountChooser',
    manageAccountUrl: 'https://myaccount.google.com/',
    managePermissionsUrl: 'https://myaccount.google.com/permissions'
  };
}

function getTaskFlowWebAppUrl_() {
  try { return ScriptApp.getService().getUrl() || ''; }
  catch (e) { return ''; }
}

function safeGetUserEmail_() {
  try { return Session.getActiveUser().getEmail() || 'Google account'; }
  catch (e) { return 'Google account'; }
}

/** Task operations go through our Streamable HTTP MCP server, not local Apps Script storage. */
function getTasks() {
  const data = callMcpTool_('list_tasks', { owner_id: getMcpOwnerId_() });
  return Array.isArray(data.tasks) ? data.tasks : [];
}

function addTask(title) {
  title = String(title || '').trim();
  if (!title) throw new Error('Please enter a task.');
  if (title.length > 180) throw new Error('Task title must be 180 characters or fewer.');
  callMcpTool_('create_task', { owner_id: getMcpOwnerId_(), title: title });
  return getTasks();
}

function toggleTask(id) {
  const tasks = getTasks();
  const task = tasks.find(function(t) { return t.id === id; });
  if (!task) throw new Error('Task not found. Refresh the task list and try again.');
  callMcpTool_('set_task_done', { owner_id: getMcpOwnerId_(), task_id: id, done: !task.done });
  return getTasks();
}

function deleteTask(id) {
  callMcpTool_('delete_task', { owner_id: getMcpOwnerId_(), task_id: String(id || '') });
  return getTasks();
}

const MCP_PROTOCOL_VERSION_ = '2025-11-25';

function getMcpConfig_() {
  const props = PropertiesService.getScriptProperties();
  let endpoint = String(props.getProperty('MCP_SERVER_URL') || '').trim().replace(/\/+$/, '');
  const token = String(props.getProperty('MCP_API_TOKEN') || '').trim();
  if (!endpoint) throw new Error('MCP_SERVER_URL is missing in Apps Script → Project Settings → Script Properties.');
  if (!/^https:\/\//i.test(endpoint)) throw new Error('MCP_SERVER_URL must be an HTTPS URL.');
  if (!/\/mcp$/i.test(endpoint)) throw new Error('MCP_SERVER_URL must end with /mcp.');
  if (!token) throw new Error('MCP_API_TOKEN is missing in Apps Script → Project Settings → Script Properties.');
  return { endpoint: endpoint, token: token };
}

function mcpHttpPost_(message, protocolVersion) {
  const config = getMcpConfig_();
  const headers = {
    Authorization: 'Bearer ' + config.token,
    Accept: 'application/json, text/event-stream'
  };
  if (protocolVersion) headers['MCP-Protocol-Version'] = protocolVersion;
  const response = UrlFetchApp.fetch(config.endpoint, {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify(message), muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const text = response.getContentText() || '';
  if (status === 202 || status === 204) return null;
  if (status < 200 || status >= 300) {
    let detail = text;
    try { detail = JSON.parse(text).error || text; } catch (ignored) {}
    throw new Error('MCP HTTP ' + status + ': ' + String(detail).slice(0, 300));
  }
  if (!text.trim()) return null;
  const headersOut = response.getHeaders();
  const contentType = String(headersOut['Content-Type'] || headersOut['content-type'] || '').toLowerCase();
  if (contentType.indexOf('text/event-stream') >= 0 || /^event:/m.test(text) || /^data:/m.test(text)) {
    const dataLines = text.split(/\r?\n/).filter(function(line) { return line.indexOf('data:') === 0; })
      .map(function(line) { return line.substring(5).trim(); }).filter(function(line) { return line && line !== '[DONE]'; });
    for (let i = dataLines.length - 1; i >= 0; i--) {
      try { return JSON.parse(dataLines[i]); } catch (ignored) {}
    }
    throw new Error('MCP returned an SSE response without a JSON data message.');
  }
  try { return JSON.parse(text); }
  catch (e) { throw new Error('MCP returned an unreadable response: ' + text.slice(0, 180)); }
}

function mcpRpc_(method, params, protocolVersion) {
  const message = { jsonrpc: '2.0', id: Utilities.getUuid(), method: method };
  if (params !== undefined && params !== null) message.params = params;
  const response = mcpHttpPost_(message, protocolVersion || null);
  if (!response) throw new Error('MCP returned no JSON-RPC response for ' + method + '.');
  if (response.error) throw new Error('MCP ' + method + ' failed: ' + (response.error.message || JSON.stringify(response.error)));
  if (!Object.prototype.hasOwnProperty.call(response, 'result')) throw new Error('MCP response did not contain a result for ' + method + '.');
  return response.result;
}

function mcpInitialize_() {
  const result = mcpRpc_('initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION_,
    capabilities: {},
    clientInfo: { name: 'taskflow-ai-google-apps-script', version: '1.0.0' }
  }, null);
  if (result.protocolVersion !== MCP_PROTOCOL_VERSION_) {
    throw new Error('Server negotiated protocol ' + result.protocolVersion + '; expected ' + MCP_PROTOCOL_VERSION_ + '.');
  }
  mcpHttpPost_({ jsonrpc: '2.0', method: 'notifications/initialized' }, MCP_PROTOCOL_VERSION_);
  return result;
}

function callMcpTool_(toolName, args) {
  mcpInitialize_();
  const result = mcpRpc_('tools/call', { name: toolName, arguments: args || {} }, MCP_PROTOCOL_VERSION_);
  if (result && result.isError) {
    const message = result.content && result.content.map(function(c) { return c.text || ''; }).join('\n');
    throw new Error(message || ('MCP tool failed: ' + toolName));
  }
  const text = result && result.content ? result.content.filter(function(c) { return c.type === 'text'; }).map(function(c) { return c.text || ''; }).join('\n') : '';
  if (!text) return result || {};
  try { return JSON.parse(text); }
  catch (e) { return { text: text }; }
}

function testMcpConnection() {
  const init = mcpInitialize_();
  const listed = mcpRpc_('tools/list', {}, MCP_PROTOCOL_VERSION_);
  const config = getMcpConfig_();
  return {
    protocolVersion: init.protocolVersion,
    endpoint: config.endpoint,
    tools: listed.tools || [],
    serverInfo: init.serverInfo || {}
  };
}

function getMcpOwnerId_() {
  const email = safeGetUserEmail_();
  return email && email !== 'Google account' ? email : 'default-taskflow-user';
}

/**
 * Executes only explicitly supported actions. This is a transparent MVP,
 * not an LLM-powered autonomous planner or computer-use system.
 */
function runMission(goal) {
  goal = String(goal || '').trim();
  if (!goal) throw new Error('Describe the mission first.');
  if (goal.length > 500) throw new Error('Please keep the mission under 500 characters.');

  const lower = goal.toLowerCase();
  const log = [];
  let status = 'completed';
  let result = '';
  log.push({stage:'PLAN', state:'done', message:'Mission received. Checking which supported action fits the request.'});

  try {
    if (/\b(add|create|make)\b/.test(lower) && /\b(task|todo|to-do)\b/.test(lower)) {
      const title = extractTaskTitle_(goal);
      if (!title) throw new Error('I could not identify a task title. Try: “Add task: finish my project”.');
      log.push({stage:'ACT', state:'running', message:'Calling MCP tool create_task through the Streamable HTTP server.'});
      addTask(title);
      log.push({stage:'VERIFY', state:'running', message:'Calling MCP tool list_tasks to independently verify the saved task.'});
      const tasks = getTasks();
      const created = tasks.find(function(t) { return t.title === title; });
      if (!created) throw new Error('The MCP server did not return the newly created task in list_tasks.');
      result = 'Task created through MCP and verified: ' + title;
      log.push({stage:'VERIFY', state:'done', message:'Verified via a second MCP tool call: task ID ' + created.id + ' is present in list_tasks.'});
    } else if (/\b(add|create|set)\b/.test(lower) && /\b(reminder|remind)\b/.test(lower)) {
      const dateMatch = goal.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})/i);
      if (!dateMatch) throw new Error('Include a date/time with timezone, e.g. “Add reminder: submit project at 2026-10-23T17:00:00+05:30”.');
      const titleRaw = goal.replace(/^\s*(please\s+)?(add|create|set)\s+(a\s+)?(new\s+)?reminder\s*[:\-]?\s*/i, '').trim();
      const title = titleRaw.replace(/\s+(?:at|for)\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})\s*$/i, '').trim();
      if (!title) throw new Error('Include a reminder title before the date/time.');
      log.push({stage:'ACT', state:'running', message:'Calling MCP tool create_reminder. This saves a record; it does not send a notification.'});
      const saved = callMcpTool_('create_reminder', { owner_id: getMcpOwnerId_(), title: title, due_at: dateMatch[0] });
      log.push({stage:'VERIFY', state:'running', message:'Calling MCP tool list_reminders to verify the saved record.'});
      const reminders = callMcpTool_('list_reminders', { owner_id: getMcpOwnerId_() }).reminders || [];
      const reminder = saved.reminder || null;
      const verified = reminder && reminders.some(function(r) { return r.id === reminder.id && r.title === title; });
      if (!verified) throw new Error('The reminder record was not found after saving.');
      result = 'Reminder record saved through MCP and verified: ' + title + ' at ' + dateMatch[0] + '. No notification was sent.';
      log.push({stage:'VERIFY', state:'done', message:'Verified via list_reminders: reminder ID ' + reminder.id + ' is present.'});
    } else if (/\b(show|list|check|view)\b/.test(lower) && /\b(tasks|todos|to-dos)\b/.test(lower)) {
      log.push({stage:'ACT', state:'running', message:'Calling MCP tool list_tasks.'});
      const tasks = getTasks();
      result = tasks.length ? 'Your tasks:\n' + tasks.slice(0, 30).map(function(t) { return (t.done ? '[x] ' : '[ ] ') + t.title; }).join('\n') : 'No tasks are saved yet.';
      log.push({stage:'VERIFY', state:'done', message:'Verified: list_tasks returned ' + tasks.length + ' task(s).'});
    } else if (/\b(show|list|check|summari[sz]e|read)\b/.test(lower) && /\b(email|emails|inbox|gmail)\b/.test(lower)) {
      log.push({stage:'ACT', state:'running', message:'Reading recent inbox metadata using your Google authorization.'});
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      const mailData = getEmailsForPeriod(formatDateInput_(from), formatDateInput_(today), 100);
      const lines = mailData.emails.slice(0, 20).map(function(e) {
        return '• ' + Utilities.formatDate(new Date(e.date), Session.getScriptTimeZone(), 'dd MMM yyyy, h:mm a') +
          ' — ' + e.subject + ' — ' + e.sender;
      });
      result = mailData.summary + (lines.length ? '\n\nRecent matching emails:\n' + lines.join('\n') : '');
      log.push({stage:'VERIFY', state:'done', message:'Verified: Gmail returned ' + mailData.total + ' matching conversation(s) for the last 7 days.'});
    } else if (/\b(show|list|check|what|view)\b/.test(lower) && /\b(calendar|events|schedule|meetings)\b/.test(lower)) {
      log.push({stage:'ACT', state:'running', message:'Reading today’s events from your default Google Calendar.'});
      const now = new Date();
      const events = CalendarApp.getDefaultCalendar().getEvents(
        new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      );
      result = events.length ? 'Today’s events:\n' + events.map(function(ev) {
        return '• ' + Utilities.formatDate(ev.getStartTime(), Session.getScriptTimeZone(), 'h:mm a') + ' — ' + ev.getTitle();
      }).join('\n') : 'No events are scheduled on your default calendar today.';
      log.push({stage:'VERIFY', state:'done', message:'Verified: Calendar returned ' + events.length + ' event(s).'});
    } else {
      status = 'needs_setup';
      result = 'I can execute task creation, task listing, reminder-record creation, and read-only Gmail/Calendar checks. This request was not executed. No unsupported action was taken.';
      log.push({stage:'ACT', state:'blocked', message:'No supported action matched this request. Nothing was changed.'});
      log.push({stage:'RECOVER', state:'suggestion', message:'Try “Add task: finish my assignment”, “Show my tasks”, “Add reminder: submit project at 2026-10-23T17:00:00+05:30”, “Show my emails”, or “Show my calendar”.'});
    }
  } catch (e) {
    status = 'failed';
    result = 'Mission failed safely: ' + friendlyError_(e);
    log.push({stage:'VERIFY', state:'failed', message:'The action did not complete successfully.'});
    log.push({stage:'RECOVER', state:'suggestion', message:'Check MCP_SERVER_URL and MCP_API_TOKEN in Script Properties, confirm the Render server is healthy, then retry. No success is reported unless the result is verified.'});
  }

  return {goal:goal, status:status, result:result, log:log, finishedAt:new Date().toISOString()};
}

function extractTaskTitle_(goal) {
  let title = goal.replace(/^\s*(please\s+)?(add|create|make)\s+(a\s+)?(new\s+)?(task|todo|to-do)\s*[:\-]?\s*/i, '').trim();
  title = title.replace(/^\s*(called|named)\s+/i, '').trim();
  if (/^(task|todo|to-do)$/i.test(title)) return '';
  return title;
}

function trimText_(text, max) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function friendlyError_(e) {
  const msg = e && e.message ? e.message : String(e);
  if (/authorization|permission|access denied|not have permission/i.test(msg)) {
    return 'Google permission is needed. Run the app while signed in and approve the requested Google access.';
  }
  return msg.slice(0, 240);
}
