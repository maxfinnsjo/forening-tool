// GitHub API helpers — uses sessionGitHubToken from app.js scope

async function ghFetch(path, options = {}) {
    const headers = {
        'Authorization': `token ${sessionGitHubToken}`,
        'Accept': 'application/vnd.github+json',
        ...( options.headers || {} )
    };
    const res = await fetch(`https://api.github.com${path}`, { ...options, headers });
    if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `GitHub API error ${res.status}`);
    }
    return res;
}

async function ghGetUser() {
    const res = await ghFetch('/user');
    if (!res.ok) return null;
    return await res.json();
}

async function ghCheckRepo(owner, repo) {
    const res = await ghFetch(`/repos/${owner}/${repo}`);
    if (res.status === 404) return null;
    return await res.json();
}

async function ghCreateRepo(orgOrNull, name, description) {
    const path = orgOrNull ? `/orgs/${orgOrNull}/repos` : '/user/repos';
    const res = await ghFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, auto_init: true, private: false })
    });
    return await res.json();
}

async function ghEnablePages(owner, repo) {
    try {
        const res = await ghFetch(`/repos/${owner}/${repo}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: { branch: 'main', path: '/' } })
        });
        // 409 = already enabled, that's fine
        if (res.status === 409 || res.ok) return true;
        return false;
    } catch (e) {
        // Pages already enabled or not supported — not fatal
        return false;
    }
}

async function ghGetFile(owner, repo, filePath) {
    const res = await ghFetch(`/repos/${owner}/${repo}/contents/${filePath}`);
    if (res.status === 404) return null;
    return await res.json();
}

async function ghPutFile(owner, repo, filePath, content) {
    // Unicode-safe base64
    const b64 = btoa(unescape(encodeURIComponent(content)));
    // Get current SHA if file exists (needed for update)
    const existing = await ghGetFile(owner, repo, filePath);
    const sha = existing ? existing.sha : undefined;

    const body = {
        message: `Update ${filePath} via Forening Tool`,
        content: b64,
        ...(sha ? { sha } : {})
    };

    const res = await ghFetch(`/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return await res.json();
}
