const queryObject = new URLSearchParams(location.search);
const serverUrl = queryObject.has('server')
    ? `http://${queryObject.get('server')}/db`
    : `${location.origin}/db`;

const db = new PouchDB(`${serverUrl}/messages`);

const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
let count = 1;
input.value = `Message ${count}`;

form.onsubmit = async e => {
    const content = input.value;
    count++;
    input.value = `Message ${count}`;
    e.preventDefault();

    const message = {
        content,
        timestamp: Date.now(),
        hostname: 'browser',
    };

    await add(message);
};

const watchChanges = () => {
    const changesEventEmitter = db
        .changes({
            live: true,
            include_docs: true,
        })
        .on('change', async change => {
            const message = change.doc;
            console.log('message change', message);
            renderMessage(message);
        })
        .on('error', error => {
            changesEventEmitter.cancel();
            setTimeout(() => watchChanges(), 3000);
        });
};
watchChanges();

const renderMessage = message => {
    const el = document.getElementById(`message-${message._id}`);

    if (el) {
        el.remove();
    }

    if (message._deleted === true) {
        return;
    }

    const template = document.createElement('template');
    template.innerHTML = `<div class="message" id="message-${message._id}">
        <div class="timestamp">${message.timestamp}</div>
        <div class="hostname">${message.hostname}</div>
        <div class="content">${message.content}</div>
        <div class="actions">
            <button onclick="remove('${message._id}');">Remove</button>
            <button onclick="update('${message._id}');">Update</button>
        </div>
    </div>`.trim();
    messages.prepend(template.content.firstChild);
};

const add = async message => {
    return await db.post(message);
};

const remove = async id => {
    const message = await db.get(id);

    return await db.remove(message);
};

const update = async id => {
    const message = await db.get(id);

    return await db.put({
        ...message,
        content: `${message.content}; updated ${Date.now()}`,
    });
};
