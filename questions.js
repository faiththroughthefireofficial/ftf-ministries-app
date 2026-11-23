const pageSize = 20;

export function setupQuestions(db) {
  const get = id => document.getElementById(id);
  const status = get('questions-status');
  const list = get('questions-list');
  const form = get('questions-form');
  const subject = get('questions-subject');
  const message = get('questions-message');
  const refresh = get('questions-refresh');
  const more = get('questions-more');
  const heading = get('questions-panel-heading');
  let userId = null;
  let reviewer = false;
  let offset = 0;
  let request = 0;

  function element(tag, text) {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
  }

  function messageCard(row, isReviewer) {
    const article = document.createElement('article');
    article.className = 'journal-item';
    const messageText = element('p', row.message);
    messageText.style.whiteSpace = 'pre-wrap';
    article.append(
      element('h4', row.subject),
      element('p', new Date(row.created_at).toLocaleDateString()),
      messageText
    );
    const replyHeading = element('strong', 'Reply from the ministry');
    const replyText = element('p', row.reply || 'Awaiting a reply');
    replyHeading.hidden = !row.reply;
    replyText.style.whiteSpace = 'pre-wrap';
    article.append(replyHeading, replyText);
    if (isReviewer) {
      const replyForm = document.createElement('form');
      replyForm.method = 'post';
      const label = element('label', 'Your reply');
      const field = document.createElement('textarea');
      field.maxLength = 3000;
      field.required = true;
      field.value = row.reply || '';
      label.append(field);
      const send = element('button', row.reply ? 'Save reply' : 'Send reply');
      send.type = 'submit';
      const result = element('p', '');
      result.setAttribute('role', 'status');
      replyForm.append(label, send, result);
      replyForm.onsubmit = async event => {
        event.preventDefault();
        const reply = field.value.trim();
        if (!reply) {
          result.textContent = 'Enter a reply first.';
          return;
        }
        send.disabled = true;
        try {
          const { error } = await db.from('ftf_questions').update({ reply })
            .eq('id', row.id).select('id').single();
          if (error) throw error;
          replyHeading.hidden = false;
          replyText.textContent = reply;
          result.textContent = 'Reply saved.';
          send.textContent = 'Save reply';
        } catch {
          result.textContent = 'The reply could not be saved. Please try again.';
        } finally {
          send.disabled = false;
        }
      };
      article.append(replyForm);
    }
    return article;
  }

  async function load(append = false, successMessage = '') {
    if (!userId) return;
    const current = ++request;
    const start = append ? offset : 0;
    refresh.disabled = more.disabled = true;
    status.textContent = 'Loading messages…';
    try {
      const { data, error } = await db.from('ftf_questions')
        .select('id,subject,message,reply,created_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(start, start + pageSize);
      if (current !== request) return;
      if (error) throw error;
      const items = data.slice(0, pageSize);
      const cards = items.map(row => messageCard(row, reviewer));
      if (append) list.append(...cards);
      else list.replaceChildren(...cards);
      offset = start + items.length;
      more.hidden = data.length <= pageSize;
      status.textContent = successMessage || (offset === 0 ? 'No messages yet.' : '');
    } catch {
      if (current === request) status.textContent = 'Messages could not be loaded. Please try again.';
    } finally {
      if (current === request) refresh.disabled = more.disabled = false;
    }
  }

  refresh.onclick = () => void load();
  more.onclick = () => void load(true);
  form.onsubmit = async event => {
    event.preventDefault();
    const owner = userId;
    const values = { subject: subject.value.trim(), message: message.value.trim() };
    if (!owner || !values.subject || !values.message) {
      status.textContent = 'Enter a subject and a message.';
      return;
    }
    const send = event.submitter;
    send.disabled = true;
    try {
      const { error } = await db.from('ftf_questions').insert(values);
      if (error) throw error;
      if (owner !== userId) return;
      form.reset();
      await load(false, 'Message sent. Check back here for a reply.');
    } catch {
      if (owner === userId) status.textContent = 'Your message could not be sent. Please try again.';
    } finally {
      send.disabled = false;
    }
  };

  async function setUser(user, retry = false) {
    const nextUserId = user?.id || null;
    if (nextUserId === userId && !retry) return;
    userId = nextUserId;
    ++request;
    const sessionRequest = request;
    reviewer = false;
    offset = 0;
    list.replaceChildren();
    form.reset();
    form.hidden = true;
    more.hidden = true;
    heading.textContent = 'My messages';
    status.textContent = '';
    get('questions-panel').hidden = !userId;
    get('questions-sign-in').hidden = Boolean(userId);
    if (!userId) return;
    status.textContent = 'Opening messages…';
    refresh.disabled = true;
    try {
      const { data, error } = await db.from('ftf_question_reviewers')
        .select('user_id').eq('user_id', nextUserId).maybeSingle();
      if (sessionRequest !== request) return;
      if (error) throw error;
      refresh.onclick = () => void load();
      reviewer = Boolean(data);
      heading.textContent = reviewer ? 'Ministry inbox' : 'My messages';
      form.hidden = reviewer;
      await load();
    } catch {
      if (sessionRequest !== request) return;
      status.textContent = 'Questions and comments are temporarily unavailable.';
      refresh.onclick = () => void setUser(user, true);
      refresh.disabled = false;
    }
  }

  return setUser;
}
