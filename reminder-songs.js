(() => {
  'use strict';
  const form = document.getElementById('song-form');
  const name = document.getElementById('guest-name');
  const entries = document.getElementById('song-entries');
  const template = entries.firstElementChild.cloneNode(true);
  const add = document.getElementById('add-song');
  const button = document.getElementById('send-song');
  const status = document.getElementById('song-status');
  const storageKey = 'lyna-hamza-song-draft-v4';
  const clean = value => value.trim().replace(/\s+/g, ' ');
  const maxSongs = 20;
  let pending = false, requestId = null, sequence = 0;
  let googleScriptUrl = '';
  try {
    const url = new URL(window.WEDDING_SONGS_CONFIG?.googleScriptUrl || '');
    if (url.protocol === 'https:' && url.hostname === 'script.google.com' && !url.username && !url.password && !url.port && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) {
      googleScriptUrl = url.origin + url.pathname;
    }
  } catch (_) { /* The collection link has not been configured yet. */ }

  function sendToSheet(payload) {
    if (!googleScriptUrl) return Promise.reject(new Error('Collection not configured'));
    return new Promise((resolve, reject) => {
      const nonce = crypto.randomUUID();
      const frame = document.createElement('iframe');
      frame.name = 'wedding-songs-' + nonce;
      frame.title = 'Envoi des suggestions';
      frame.hidden = true;
      const post = document.createElement('form');
      post.method = 'POST'; post.action = googleScriptUrl; post.target = frame.name; post.hidden = true;
      for (const [key, value] of Object.entries({payload:JSON.stringify(payload), nonce, replyOrigin:location.origin})) {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = key; input.value = value; post.append(input);
      }
      let timer;
      function cleanup() {
        clearTimeout(timer); window.removeEventListener('message', onMessage); post.remove(); frame.remove();
      }
      function onMessage(event) {
        let trustedOrigin = false;
        try {
          const origin = new URL(event.origin);
          trustedOrigin = origin.protocol === 'https:' && (origin.hostname === 'script.googleusercontent.com' || origin.hostname.endsWith('-script.googleusercontent.com'));
        } catch (_) { return; }
        const result = event.data;
        if (!trustedOrigin || !result || result.type !== 'wedding-song-result' || result.nonce !== nonce || result.requestId !== payload.requestId) return;
        cleanup(); resolve(result);
      }
      window.addEventListener('message', onMessage);
      timer = setTimeout(() => {cleanup(); reject(new Error('Confirmation timed out'));}, 45000);
      document.body.append(frame, post);
      try { HTMLFormElement.prototype.submit.call(post); }
      catch (error) { cleanup(); reject(error); }
    });
  }
  const rows = () => [...entries.querySelectorAll('.song-entry')];
  const songValues = () => rows().map(row => ({ title: row.querySelector('[name="songTitle"]').value, artist: row.querySelector('[name="songArtist"]').value }));
  function saveDraft() {
    try { localStorage.setItem(storageKey, JSON.stringify({guestName:name.value, songs:songValues(), requestId})); }
    catch (_) { /* Submission does not require browser storage. */ }
  }
  function changed() {
    requestId = null;
    status.textContent = '';
    status.removeAttribute('data-error');
    saveDraft();
  }
  function refresh() {
    rows().forEach((row, index, all) => {
      row.querySelector('legend').textContent = 'Chanson ' + (index + 1);
      const remove = row.querySelector('.remove-song');
      remove.hidden = all.length === 1;
      remove.disabled = pending;
      remove.setAttribute('aria-label', 'Retirer la chanson ' + (index + 1));
    });
    add.disabled = pending || rows().length >= maxSongs;
    button.disabled = pending;
    button.textContent = pending ? 'Envoi en cours…' : rows().length === 1 ? 'Envoyer ma chanson' : 'Envoyer mes chansons';
  }
  function appendSong(song = {}) {
    const row = template.cloneNode(true);
    sequence++;
    const title = row.querySelector('[name="songTitle"]');
    const artist = row.querySelector('[name="songArtist"]');
    title.id = 'song-title-' + sequence;
    artist.id = 'song-artist-' + sequence;
    row.querySelectorAll('label')[0].htmlFor = title.id;
    row.querySelectorAll('label')[1].htmlFor = artist.id;
    title.value = typeof song.title === 'string' ? song.title : '';
    artist.value = typeof song.artist === 'string' ? song.artist : '';
    row.querySelector('.remove-song').addEventListener('click', () => {
      if (pending || rows().length === 1) return;
      const neighbour = row.nextElementSibling || row.previousElementSibling;
      row.remove(); changed(); refresh(); neighbour.querySelector('input').focus();
    });
    entries.append(row);
    return row;
  }
  entries.replaceChildren();
  try {
    let draft = JSON.parse(localStorage.getItem(storageKey));
    // Preserve a single-song draft from the previous form.
    if (!draft) {
      const old = JSON.parse(localStorage.getItem('lyna-hamza-song-draft-v3'));
      if (old) draft = {guestName:old.guestName, songs:[{title:old.songTitle,artist:old.songArtist}]};
    }
    if (draft && typeof draft === 'object') {
      if (typeof draft.guestName === 'string' && draft.guestName.length <= 80) name.value = draft.guestName;
      if (Array.isArray(draft.songs)) draft.songs.slice(0, maxSongs).forEach(song => {
        if (song && typeof song.title === 'string' && typeof song.artist === 'string' && song.title.length <= 120 && song.artist.length <= 120) appendSong(song);
      });
      if (typeof draft.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(draft.requestId)) requestId = draft.requestId;
    }
  } catch (_) { /* Storage is optional. */ }
  if (!rows().length) appendSong();
  form.addEventListener('input', event => {
    if (pending) return;
    if (event.target instanceof HTMLInputElement) event.target.setCustomValidity('');
    changed();
  });
  add.addEventListener('click', () => {
    if (pending || rows().length >= maxSongs) return;
    const row = appendSong(); changed(); refresh(); row.querySelector('input').focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    const fields = [name, ...entries.querySelectorAll('input')];
    for (const field of fields) {
      field.setCustomValidity(clean(field.value) ? '' : 'Veuillez remplir ce champ.');
      if (!field.reportValidity()) return;
    }
    const songs = songValues().map(song => ({title:clean(song.title),artist:clean(song.artist)}));
    requestId ||= crypto.randomUUID();
    saveDraft(); pending = true; refresh();
    form.setAttribute('aria-busy', 'true');
    fields.forEach(field => { field.readOnly = true; });
    status.textContent = ''; status.removeAttribute('data-error');
    try {
      const result = await sendToSheet({requestId, guestName:clean(name.value), songs, website:form.elements.website.value});
      if (result.saved !== true || result.count !== songs.length) throw new Error('Submission not confirmed');
      status.textContent = songs.length === 1 ? 'Merci ! Votre chanson est enregistrée ♡' : 'Merci ! Vos ' + songs.length + ' chansons sont enregistrées ♡';
      entries.replaceChildren(); appendSong(); requestId = null; saveDraft();
    } catch (_) {
      status.dataset.error = 'true';
      status.textContent = googleScriptUrl ? 'L’envoi n’a pas pu être confirmé. Vos chansons sont conservées ici : réessayez.' : 'Les suggestions ne sont pas encore ouvertes. Réessayez un peu plus tard.';
    } finally {
      pending = false; refresh();
      form.removeAttribute('aria-busy');
      fields.forEach(field => { field.readOnly = false; });
    }
  });
  refresh();
})();
