let associations = [];
let currentAssocId = null;
let currentMemberId = null;
let sessionPassword = null; // Stored only in memory during the session
let sessionGitHubToken = null;
let sessionGitHubUser = null;

// Helper: Sanitize string to prevent XSS
function escapeHTML(str) {
    if (!str) return "";
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
}

// Helper: Generate unique IDs (consistent with templates.js)
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

async function init() {
    applyTheme();
    
    if (isStorageEncrypted()) {
        showLogin();
    } else {
        associations = await loadData();
        // Hash-based routing
        window.onhashchange = handleRoute;
        handleRoute();
    }
}

function showLogin() {
    hideAll();
    document.getElementById("loginView").style.display = "block";
    document.getElementById("navHome").style.display = "none";
    document.getElementById("navSettings").style.display = "none";
    document.getElementById("navTitle").innerText = "🔒 Security";
}

async function attemptLogin() {
    const pass = document.getElementById("loginPass").value;
    const data = await loadData(pass);
    
    if (data) {
        associations = data;
        sessionPassword = pass;
        
        // Success: Restore UI
        document.getElementById("navHome").style.display = "inline-flex";
        document.getElementById("navSettings").style.display = "inline-flex";
        
        window.onhashchange = handleRoute;
        handleRoute();
    } else {
        alert("Incorrect password or corrupted database.");
    }
}

async function handleRoute() {
    const hash = window.location.hash || "#home";
    const [page, id] = hash.replace("#", "").split("/");

    if (page === "settings") {
        showSettings(false); 
    } else if (page === "create") {
        showCreateForm(false);
    } else if (page === "dashboard" && id) {
        currentAssocId = id;
        renderDashboard(false);
    } else {
        renderAssociationList(false);
    }
}

function navigate(hash) {
    window.location.hash = hash;
}

function hideAll() {
    document.querySelectorAll("body > div:not(.modal), nav").forEach(el => {
        if (el.tagName !== "NAV") el.style.display = "none";
    });
    // Hide all modals
    document.querySelectorAll(".modal").forEach(el => el.style.display = "none");
}

function showSettings(shouldNavigate = true) {
    if (shouldNavigate) return navigate("settings");
    hideAll();
    document.getElementById("settingsView").style.display = "block";
    document.getElementById("themeSelect").value = localStorage.getItem("theme") || "light";
    
    // We don't show the master password in plaintext anymore if session is locked
    document.getElementById("masterPass").value = sessionPassword || "";
    document.getElementById("navTitle").innerText = "Settings";
}

async function saveMasterPass() {
    const pass = document.getElementById("masterPass").value;
    sessionPassword = pass;
    // When password is changed in settings, re-save the entire database with new encryption
    await saveData(associations, sessionPassword);
    alert("Encryption key updated and database secured.");
}

function toggleTheme() {
    const theme = document.getElementById("themeSelect").value;
    localStorage.setItem("theme", theme);
    applyTheme();
}

function applyTheme() {
    const theme = localStorage.getItem("theme") || "light";
    document.body.setAttribute("data-theme", theme);
}

function resetAllData() {
    if (confirm("DANGER: This will delete ALL associations and settings. Proceed?")) {
        clearData();
        location.reload();
    }
}

function showCreateForm(shouldNavigate = true) {
    if (shouldNavigate) return navigate("create");
    hideAll();
    document.getElementById("createForm").style.display = "block";
    document.getElementById("navTitle").innerText = "New Association";
    
    document.getElementById("name").value = "";
    document.getElementById("purpose").value = "";
    document.querySelectorAll(".member").forEach(i => i.value = "");
}

async function renderAssociationList(shouldNavigate = true) {
    if (shouldNavigate) return navigate("home");
    
    // Refresh data if possible
    const freshData = await loadData(sessionPassword);
    if (freshData) associations = freshData;

    currentAssocId = null;
    hideAll();
    document.getElementById("associationList").style.display = "block";
    document.getElementById("navTitle").innerText = "Association Hub";

    const list = document.getElementById("listContainer");
    list.innerHTML = "";

    if (associations.length === 0) {
        list.innerHTML = "<p>No associations found. Create one to get started!</p>";
        return;
    }

    associations.forEach((assoc) => {
        const li = document.createElement("li");
        li.style.cursor = "pointer";
        li.innerHTML = `<div><strong>${escapeHTML(assoc.name)}</strong><br><small>${assoc.members.length} members</small></div>
                        <button class="secondary">Open</button>`;
        li.onclick = () => selectAssociation(assoc.id);
        list.appendChild(li);
    });
}

function selectAssociation(id) {
    navigate(`dashboard/${id}`);
}

async function createAssociation() {
    const name = document.getElementById("name").value;
    const purpose = document.getElementById("purpose").value;
    const contact = document.getElementById("contact").value;
    const linksRaw = document.getElementById("links").value;
    const badge = document.getElementById("badge").value;
    
    const firstNames = document.querySelectorAll(".m-first");
    const lastNames = document.querySelectorAll(".m-last");
    
    const members = [];
    firstNames.forEach((input, i) => {
        if (input.value.trim() !== "") {
            members.push({
                firstName: input.value.trim(),
                lastName: lastNames[i].value.trim()
            });
        }
    });

    if (members.length < 3) {
        alert("Minimum 3 board members required (Chair, Treasurer, Secretary)");
        return;
    }

    const newAssoc = createAssociationTemplate(name, purpose, members, contact, linksRaw.split('\n').filter(l=>l.trim()), badge);

    // Automatically Seal Founding Protocol if Password exists
    if (sessionPassword) {
        const foundingProtocol = `--- FOUNDING MEMBER LIST ---\nAssociation: ${name}\nDate: ${new Date().toLocaleDateString()}\n\nMembers:\n` + 
                                members.map((m, i) => `${i+1}. ${m.firstName} ${m.lastName}`).join('\n');
        const encrypted = await encryptData(sessionPassword, foundingProtocol);
        newAssoc.vault = [{
            id: generateId(),
            title: "Founding Member Protocol (Bildningsmedlemmar)",
            date: new Date().toLocaleString(),
            encrypted: encrypted
        }];
    }

    associations.push(newAssoc);
    await saveData(associations, sessionPassword);

    selectAssociation(newAssoc.id);
}
function getCurrentAssoc() {
    return associations.find(a => a.id === currentAssocId);
}

function getCheckpoint(assocId) {
    const raw = sessionStorage.getItem(`checkpoint_${assocId}`);
    return raw ? JSON.parse(raw) : null;
}

function setCheckpoint(assoc) {
    sessionStorage.setItem(`checkpoint_${assoc.id}`, JSON.stringify(assoc));
}

// Listen for changes from other tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'forening_data') {
        // Data changed in another tab, refresh our local associations array
        // but DON'T update our checkpoint. renderDashboard will then find the differences.
        loadData(sessionPassword).then(data => {
            if (data) {
                associations = data;
                renderDashboard(false);
            }
        });
    }
});

async function saveData(data, password = null) {
    const json = JSON.stringify(data);
    
    // If no password, save as plaintext (standard behavior if security not setup)
    if (!password) {
        localStorage.setItem(STORAGE_KEY, json);
    } else {
        try {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await deriveKey(password, salt);
            const encrypted = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv }, key, new TextEncoder().encode(json)
            );

            const payload = {
                salt: btoa(String.fromCharCode(...salt)),
                iv: btoa(String.fromCharCode(...iv)),
                data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
                encrypted: true
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            localStorage.setItem(SEC_KEY, "active"); 
        } catch (e) {
            console.error("Encryption failed", e);
            alert("Failed to encrypt data!");
            return;
        }
    }

    // CRITICAL: Update our own checkpoint so we don't alert on our own changes
    if (currentAssocId) {
        const assoc = data.find(a => a.id === currentAssocId);
        if (assoc) setCheckpoint(assoc);
    }
}

function getChangeSummary(assoc) {
    const old = getCheckpoint(assoc.id);
    if (!old) return [];
    
    const changes = [];
    
    // Check Members
    const memberDiff = assoc.members.length - (old.members || []).length;
    if (memberDiff > 0) changes.push(`+${memberDiff} Member(s)`);
    else if (memberDiff < 0) changes.push(`${Math.abs(memberDiff)} Removed Member(s)`);

    // Check Meetings
    const meetingDiff = assoc.meetings.length - (old.meetings || []).length;
    if (meetingDiff > 0) changes.push(`+${meetingDiff} Meeting(s)`);
    else if (meetingDiff < 0) changes.push(`${Math.abs(meetingDiff)} Removed Meeting(s)`);

    // Check Ideas
    const ideaDiff = (assoc.ideas || []).length - (old.ideas || []).length;
    if (ideaDiff > 0) changes.push(`+${ideaDiff} Idea(s)`);
    else if (ideaDiff < 0) changes.push(`${Math.abs(ideaDiff)} Removed Idea(s)`);
    
    // Check for edits in items that exist in both
    let edits = 0;
    assoc.meetings.forEach(m => {
        const oldM = (old.meetings || []).find(x => x.id === m.id);
        if (oldM && m.lastModified !== oldM.lastModified) edits++;
    });
    
    assoc.members.forEach(m => {
        const oldM = (old.members || []).find(x => x.id === m.id);
        if (oldM && m.lastModified !== oldM.lastModified) edits++;
    });

    if (assoc.lastModified !== old.lastModified && edits === 0) {
        changes.push("General Info Edit");
    } else if (edits > 0) {
        changes.push(`${edits} Content Edit(s)`);
    }

    return changes;
}

function createCheckpoint() {
    const assoc = getCurrentAssoc();
    if (!assoc) return;
    setCheckpoint(assoc);
    renderDashboard(false);
}

function renderDashboard(shouldNavigate = true) {
    const association = getCurrentAssoc();
    if (!association) {
        renderAssociationList();
        return;
    }

    if (shouldNavigate) return navigate(`dashboard/${association.id}`);

    // If no checkpoint for this session yet, create one as the baseline
    if (!getCheckpoint(association.id)) {
        setCheckpoint(association);
    }

    hideAll();
    document.getElementById("dashboard").style.display = "block";
    document.getElementById("navTitle").innerText = association.name;
    document.getElementById("assocName").innerText = association.name;

    // Activity Tracking / Sync Check
    const syncStatus = document.getElementById("syncStatus");
    const syncMsg = document.getElementById("syncMessage");
    const changes = getChangeSummary(association);
    const old = getCheckpoint(association.id);

    if (changes.length > 0) {
        syncStatus.style.display = "block";
        syncMsg.innerText = `⚠️ Changes found: ${changes.join(', ')}`;
    } else {
        syncStatus.style.display = "none";
    }

    // Association Info (Public-ish)
    document.getElementById("assocPurpose").innerText = association.purpose;
    document.getElementById("assocContact").innerText = association.contact || "None provided";
    document.getElementById("asciiBadge").innerText = association.badge || "........\n........\n........\n........\n........\n........\n........\n........";
    
    const linksDiv = document.getElementById("assocLinks");
    linksDiv.innerHTML = "";
    if (association.links && association.links.length > 0) {
        association.links.forEach(link => {
            const a = document.createElement("a");
            a.href = link;
            a.target = "_blank";
            a.innerText = link;
            a.style.display = "block";
            linksDiv.appendChild(a);
        });
    }

    const masterPassSet = isStorageEncrypted();
    const sessionUnlocked = !!sessionStorage.getItem("vault_unlocked");

    // Member Privacy
    const mList = document.getElementById("memberList");
    const mShield = document.getElementById("membersPrivacyShield");
    const revealMBtn = document.getElementById("revealMembersBtn");
    
    // Set member count
    document.getElementById("memberCount").innerText = association.members.length;

    if (masterPassSet && !sessionUnlocked) {
        mList.style.display = "none";
        mShield.style.display = "block";
        revealMBtn.style.display = "block";
    } else {
        mList.style.display = "block";
        mShield.style.display = "none";
        revealMBtn.style.display = "none";

        mList.innerHTML = "";
        association.members.forEach((m) => {
            const oldM = old ? old.members.find(x => x.id === m.id) : null;
            const isNew = old && !oldM;
            const isModified = oldM && m.lastModified !== oldM.lastModified;
            
            const li = document.createElement("li");
            if (isNew || isModified) li.style.borderLeft = "4px solid #ffc107";
            
            let statusBadge = "";
            if (isNew) statusBadge = '<span class="badge" style="background:#ffc107;color:#000">NEW</span>';
            else if (isModified) statusBadge = '<span class="badge" style="background:#17a2b8;color:#fff">EDITED</span>';

            li.innerHTML = `
                <div class="flex-row" style="flex:1">
                    <div style="flex:1">
                        <strong>${escapeHTML(m.firstName)} ${escapeHTML(m.lastName || "")}</strong> ${statusBadge}<br>
                        <small>
                            ${m.phone ? '📞 ' + escapeHTML(m.phone) + ' | ' : ''}
                            ${m.email ? '📧 ' + escapeHTML(m.email) + ' | ' : ''}
                            Joined: ${new Date(m.joined).toLocaleDateString()}
                        </small>
                    </div>
                    <div class="flex-row">
                        <button class="secondary" style="padding:4px 8px" onclick="editMember('${m.id}')" title="Edit Member">✏️</button>
                        ${(isNew || isModified) ? `<button class="secondary" style="padding:4px 8px" onclick="markItemAsSeen('members', '${m.id}')" title="Mark as seen">✔️</button>` : ''}
                        <select onchange="changeMemberRole('${m.id}', this.value)" style="width: auto; margin-bottom: 0; padding: 2px 5px; font-size: 12px;">
                            <option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option>
                            <option value="chair" ${m.role === 'chair' ? 'selected' : ''}>Chair</option>
                            <option value="treasurer" ${m.role === 'treasurer' ? 'selected' : ''}>Treasurer</option>
                            <option value="secretary" ${m.role === 'secretary' ? 'selected' : ''}>Secretary</option>
                            <option value="auditor" ${m.role === 'auditor' ? 'selected' : ''}>Auditor (Revisor)</option>
                            <option value="substitute" ${m.role === 'substitute' ? 'selected' : ''}>Substitute</option>
                        </select>
                    </div>
                </div>
                <button class="danger" style="padding:4px 8px; margin-left: 10px;" onclick="deleteMember('${m.id}')">×</button>`;
            mList.appendChild(li);
        });
    }

    // Meetings Privacy
    const meetList = document.getElementById("meetingList");
    const meetShield = document.getElementById("meetingsPrivacyShield");
    const revealMeetBtn = document.getElementById("revealMeetingsBtn");
    const newMeetBtn = document.getElementById("newMeetingBtn");

    if (masterPassSet && !sessionUnlocked) {
        meetList.style.display = "none";
        meetShield.style.display = "block";
        revealMeetBtn.style.display = "block";
        newMeetBtn.style.display = "none";
    } else {
        meetList.style.display = "block";
        meetShield.style.display = "none";
        revealMeetBtn.style.display = "none";
        newMeetBtn.style.display = "inline-flex";

        meetList.innerHTML = "";
        if (association.meetings.length === 0) {
            meetList.innerHTML = "<li>No meetings scheduled.</li>";
        } else {
            association.meetings.forEach((m) => {
                const oldM = old ? old.meetings.find(x => x.id === m.id) : null;
                const isNew = old && !oldM;
                const isModified = oldM && m.lastModified !== oldM.lastModified;

                const li = document.createElement("li");
                if (isNew || isModified) li.style.borderLeft = "4px solid #ffc107";
                li.style.cursor = "pointer";

                let statusBadge = "";
                if (isNew) statusBadge = '<span class="badge" style="background:#ffc107;color:#000">NEW</span>';
                else if (isModified) statusBadge = '<span class="badge" style="background:#17a2b8;color:#fff">EDITED</span>';

                li.innerHTML = `
                    <div style="flex:1" onclick="viewMeeting('${m.id}')">
                        <strong>${escapeHTML(m.title)}</strong> - ${escapeHTML(m.date)} ${statusBadge}<br>
                        <small>Created: ${new Date(m.created).toLocaleDateString()}</small>
                    </div>
                    <div class="flex-row">
                        ${(isNew || isModified) ? `<button class="secondary" style="padding:4px 8px" onclick="markItemAsSeen('meetings', '${m.id}')">✔️ Mark seen</button>` : ''}
                        <span class="badge">${m.decisions ? m.decisions.length : 0} Decisions</span>
                    </div>`;
                meetList.appendChild(li);
            });
        }
    }

    // Ideas Privacy
    const ideasContent = document.getElementById("ideasContent");
    const ideasShield = document.getElementById("ideasPrivacyShield");
    const revealIdeasBtn = document.getElementById("revealIdeasBtn");

    if (masterPassSet && !sessionUnlocked) {
        ideasContent.style.display = "none";
        ideasShield.style.display = "block";
        revealIdeasBtn.style.display = "block";
    } else {
        ideasContent.style.display = "block";
        ideasShield.style.display = "none";
        revealIdeasBtn.style.display = "none";
        renderIdeas();
    }

    // GitHub Panel
    const ghCard = document.getElementById("githubCard");
    if (ghCard) {
        if (sessionGitHubToken && association.github) {
            ghCard.style.display = "block";
            document.getElementById("ghCardRepo").textContent = `${association.github.owner}/${association.github.repo}`;
            const pagesUrl = `https://${association.github.owner}.github.io/${association.github.repo}/`;
            document.getElementById("ghCardPagesUrl").href = pagesUrl;
            document.getElementById("ghCardPagesUrl").textContent = pagesUrl;
        } else if (sessionGitHubToken && !association.github) {
            ghCard.style.display = "block";
            document.getElementById("ghCardRepo").textContent = "Not connected";
            document.getElementById("ghCardPagesUrl").href = "#";
            document.getElementById("ghCardPagesUrl").textContent = "—";
        } else {
            ghCard.style.display = "none";
        }
    }
}

function revealSensitiveSections() {
    const pass = prompt("Enter Database Encryption Key to reveal sensitive data:");
    if (pass === sessionPassword) {
        sessionStorage.setItem("vault_unlocked", "true");
        renderDashboard(false);
    } else {
        alert("Incorrect key.");
    }
}

function revealMembers() {
    revealSensitiveSections();
}

function openEditInfoModal() {
    const assoc = getCurrentAssoc();
    if (!assoc) return;

    document.getElementById("editName").value = assoc.name;
    document.getElementById("editPurpose").value = assoc.purpose;
    document.getElementById("editContact").value = assoc.contact || "";
    document.getElementById("editLinks").value = (assoc.links || []).join('\n');
    document.getElementById("editBadge").value = assoc.badge || "";

    document.getElementById("editInfoModal").style.display = "block";
}

function closeEditInfoModal() {
    document.getElementById("editInfoModal").style.display = "none";
}

async function saveAssocInfo() {
    const assoc = getCurrentAssoc();
    if (!assoc) return;

    // Check if master password is set and session is locked
    const correctPass = sessionPassword;
    const sessionUnlocked = !!sessionStorage.getItem("vault_unlocked");
    
    if (correctPass && !sessionUnlocked) {
        const pass = prompt("Enter Database Encryption Key to authorize changes:");
        if (pass !== correctPass) {
            alert("Incorrect key. Changes not saved.");
            return;
        }
        // Unlock session since they provided the correct password
        sessionStorage.setItem("vault_unlocked", "true");
    }

    const now = new Date().toISOString();
    assoc.name = document.getElementById("editName").value;
    assoc.purpose = document.getElementById("editPurpose").value;
    assoc.contact = document.getElementById("editContact").value;
    assoc.links = document.getElementById("editLinks").value.split('\n').filter(l => l.trim() !== "");
    assoc.badge = document.getElementById("editBadge").value;
    assoc.lastModified = now;

    await saveData(associations, sessionPassword);
    closeEditInfoModal();
    renderDashboard(false);
}

function renderIdeas() {
    const association = getCurrentAssoc();
    const list = document.getElementById("ideasList");
    if (!list) return; // Guard against dashboard being hidden
    
    const old = getCheckpoint(association.id);
    list.innerHTML = "";
    if (!association.ideas) association.ideas = [];

    association.ideas.forEach((idea, idx) => {
        const text = typeof idea === 'string' ? idea : idea.text;
        const created = idea.created ? new Date(idea.created).toLocaleDateString() : 'N/A';
        
        // Ideas are tracked by index/text since they don't have IDs usually
        const oldIdea = old && old.ideas ? old.ideas[idx] : null;
        const isNew = old && (!oldIdea || (typeof oldIdea === 'string' ? oldIdea !== text : oldIdea.text !== text));

        const li = document.createElement("li");
        if (isNew) li.style.borderLeft = "4px solid #ffc107";
        li.innerHTML = `
            <div style="flex:1">
                <span>${escapeHTML(text)}</span> ${isNew ? '<span class="badge" style="background:#ffc107;color:#000">NEW</span>' : ''}<br>
                <small>Added: ${created}</small>
            </div>
            <div class="flex-row">
                ${isNew ? `<button class="secondary" style="padding:4px 8px" onclick="markItemAsSeen('ideas', ${idx})">✔️</button>` : ''}
                <button class="danger" style="padding:4px 8px" onclick="deleteIdea(${idx})">×</button>
            </div>`;
        list.appendChild(li);
    });
}

function markItemAsSeen(type, idOrIdx) {
    const assoc = getCurrentAssoc();
    const checkpoint = getCheckpoint(assoc.id);
    if (!checkpoint) return;

    if (type === 'members') {
        const item = assoc.members.find(m => m.id === idOrIdx);
        if (item) {
            const oldIdx = checkpoint.members.findIndex(m => m.id === idOrIdx);
            if (oldIdx > -1) checkpoint.members[oldIdx] = JSON.parse(JSON.stringify(item));
            else checkpoint.members.push(JSON.parse(JSON.stringify(item)));
        }
    } else if (type === 'meetings') {
        const item = assoc.meetings.find(m => m.id === idOrIdx);
        if (item) {
            const oldIdx = checkpoint.meetings.findIndex(m => m.id === idOrIdx);
            if (oldIdx > -1) checkpoint.meetings[oldIdx] = JSON.parse(JSON.stringify(item));
            else checkpoint.meetings.push(JSON.parse(JSON.stringify(item)));
        }
    } else if (type === 'ideas') {
        const item = assoc.ideas[idOrIdx];
        if (item) {
            if (!checkpoint.ideas) checkpoint.ideas = [];
            checkpoint.ideas[idOrIdx] = JSON.parse(JSON.stringify(item));
        }
    }

    setCheckpoint(checkpoint);
    renderDashboard(false);
}

async function addIdea() {
    const input = document.getElementById("newIdea");
    const ideaText = input.value.trim();
    if (!ideaText) return;

    const now = new Date().toISOString();
    const association = getCurrentAssoc();
    if (!association.ideas) association.ideas = [];
    association.ideas.push({
        text: ideaText,
        created: now,
        lastModified: now
    });
    association.lastModified = now;
    await saveData(associations, sessionPassword);
    renderIdeas();
    input.value = "";
}

async function deleteIdea(idx) {
    const association = getCurrentAssoc();
    association.ideas.splice(idx, 1);
    association.lastModified = new Date().toISOString();
    await saveData(associations, sessionPassword);
    renderIdeas();
}

async function deleteMember(memberId) {
    const association = getCurrentAssoc();
    if (association.members.length <= 3) {
        alert("Warning: An association should legally have at least 3 members.");
    }
    if(confirm("Remove this member?")) {
        association.members = association.members.filter(m => m.id !== memberId);
        association.lastModified = new Date().toISOString();
        syncBoard(association);
        await saveData(associations, sessionPassword);
        renderDashboard(false);
    }
}

async function changeMemberRole(memberId, newRole) {
    const association = getCurrentAssoc();
    const member = association.members.find(m => m.id === memberId);
    if (!member) return;

    const now = new Date().toISOString();
    member.role = newRole;
    member.lastModified = now;
    association.lastModified = now;
    syncBoard(association);
    await saveData(associations, sessionPassword);
    // No need to re-render everything, the select is already at the correct value
}

function syncBoard(assoc) {
    // Reset board
    assoc.board = { chair: "Ej angivet", treasurer: "Ej angivet", secretary: "Ej angivet" };
    
    // Find people with roles and update board
    assoc.members.forEach(m => {
        if (m.role === 'chair') assoc.board.chair = m.name;
        if (m.role === 'treasurer') assoc.board.treasurer = m.name;
        if (m.role === 'secretary') assoc.board.secretary = m.name;
    });
}

function openMemberModal() {
    currentMemberId = null;
    document.getElementById("memberModalTitle").innerText = "Add Member";
    document.getElementById("mFirstName").value = "";
    document.getElementById("mLastName").value = "";
    document.getElementById("mPhone").value = "";
    document.getElementById("mEmail").value = "";
    document.getElementById("mAddress").value = "";
    document.getElementById("memberModal").style.display = "block";
}

function closeMemberModal() {
    document.getElementById("memberModal").style.display = "none";
}

async function saveMember() {
    const firstName = document.getElementById("mFirstName").value.trim();
    const lastName = document.getElementById("mLastName").value.trim();
    const phone = document.getElementById("mPhone").value.trim();
    const email = document.getElementById("mEmail").value.trim();
    const address = document.getElementById("mAddress").value.trim();
    
    if (!firstName) return alert("First Name is required.");

    const now = new Date().toISOString();
    const association = getCurrentAssoc();
    
    if (currentMemberId) {
        // Edit existing
        const m = association.members.find(m => m.id === currentMemberId);
        if (m) {
            m.firstName = firstName;
            m.lastName = lastName;
            m.phone = phone;
            m.email = email;
            m.address = address;
            m.name = `${firstName} ${lastName}`.trim();
            m.lastModified = now;
        }
    } else {
        // Add new
        association.members.push({
            id: generateId(),
            firstName,
            lastName,
            phone,
            email,
            address,
            name: `${firstName} ${lastName}`.trim(),
            joined: now,
            lastModified: now,
            role: "member"
        });
    }

    association.lastModified = now;
    syncBoard(association);
    await saveData(associations, sessionPassword);
    closeMemberModal();
    renderDashboard(false);
}

function editMember(memberId) {
    const association = getCurrentAssoc();
    const m = association.members.find(m => m.id === memberId);
    if (!m) return;

    currentMemberId = memberId;
    document.getElementById("memberModalTitle").innerText = "Edit Member";
    document.getElementById("mFirstName").value = m.firstName || "";
    document.getElementById("mLastName").value = m.lastName || "";
    document.getElementById("mPhone").value = m.phone || "";
    document.getElementById("mEmail").value = m.email || "";
    document.getElementById("mAddress").value = m.address || "";
    document.getElementById("memberModal").style.display = "block";
}

function viewBylaws() {
    const association = getCurrentAssoc();
    if (!association) return;
    
    const bylaws = association.customStadgar || generateBylaws(association);
    
    document.getElementById("bylawsContent").innerText = bylaws;
    document.getElementById("bylawsDisplay").style.display = "block";
    document.getElementById("bylawsEdit").style.display = "none";
    document.getElementById("bylawsModal").style.display = "block";
}

function prepareEditBylaws() {
    const association = getCurrentAssoc();
    const bylaws = association.customStadgar || generateBylaws(association);
    
    document.getElementById("bylawsEditor").value = bylaws;
    document.getElementById("bylawsPass").value = "";
    document.getElementById("bylawsDisplay").style.display = "none";
    document.getElementById("bylawsEdit").style.display = "block";
}

function cancelEditBylaws() {
    document.getElementById("bylawsDisplay").style.display = "block";
    document.getElementById("bylawsEdit").style.display = "none";
}

async function saveBylaws() {
    const enteredPass = document.getElementById("bylawsPass").value;
    const correctPass = sessionPassword || "";

    if (enteredPass !== correctPass) {
        alert("Incorrect key!");
        return;
    }

    const newContent = document.getElementById("bylawsEditor").value;
    getCurrentAssoc().customStadgar = newContent;
    
    await saveData(associations, sessionPassword);
    viewBylaws();
}

function closeBylaws() {
    document.getElementById("bylawsModal").style.display = "none";
}

function downloadBylaws() {
    const association = getCurrentAssoc();
    if (!association) return;
    const bylaws = association.customStadgar || generateBylaws(association);
    const blob = new Blob([bylaws], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Stadgar_${association.name.replace(/\s+/g, '_')}.txt`;
    a.click();
}

function exportPublicSite() {
    const association = getCurrentAssoc();
    if (!association) return;
    const html = generatePublicSite(association);
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `index_${association.name.replace(/\s+/g, '_')}.html`;
    a.click();
}

function exportData() {
    const association = getCurrentAssoc();
    if (!association) return;
    const dataStr = JSON.stringify(association, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${association.name.replace(/\s+/g, '_')}_data.json`;
    a.click();
}

async function resetAssociation() {
    const association = getCurrentAssoc();
    if (!association) return;
    if (confirm("Delete this association? This action cannot be undone.")) {
        associations = associations.filter(a => a.id !== currentAssocId);
        await saveData(associations, sessionPassword);
        await renderAssociationList();
    }
}

// Meeting Logic
let currentMeetingId = null;

function getCurrentMeeting() {
    const association = getCurrentAssoc();
    if (!association) return null;
    return association.meetings.find(m => m.id === currentMeetingId);
}

function openMeetingModal() {
    currentMeetingId = null;
    document.getElementById("meetingModalTitle").innerText = "New Meeting";
    document.getElementById("meetingCreateFields").style.display = "block";
    document.getElementById("meetingViewFields").style.display = "none";
    document.getElementById("mTitle").value = "";
    document.getElementById("mDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("mAgenda").value = "";
    document.getElementById("meetingModal").style.display = "block";
}

function closeMeetingModal() {
    document.getElementById("meetingModal").style.display = "none";
}

async function saveMeeting() {
    const title = document.getElementById("mTitle").value;
    const date = document.getElementById("mDate").value;
    const agendaRaw = document.getElementById("mAgenda").value;
    if (!title || !date) return alert("Title and Date are required");

    const agenda = agendaRaw.split('\n').filter(line => line.trim() !== "");
    const now = new Date().toISOString();
    const newMeeting = { 
        id: generateId(),
        title, 
        date, 
        agenda, 
        decisions: [], 
        votes: [], 
        created: now,
        lastModified: now
    };

    const assoc = getCurrentAssoc();
    assoc.meetings.push(newMeeting);
    assoc.lastModified = now;
    await saveData(associations, sessionPassword);
    renderDashboard(false);
    closeMeetingModal();
}

function viewMeeting(meetingId) {
    currentMeetingId = meetingId;
    const meeting = getCurrentMeeting();
    if (!meeting) return;

    document.getElementById("meetingModalTitle").innerText = meeting.title;
    document.getElementById("meetingCreateFields").style.display = "none";
    document.getElementById("meetingViewFields").style.display = "block";
    document.getElementById("meetingEditForm").style.display = "none";
    document.getElementById("vDate").innerText = meeting.date;
    
    // Set protocol timestamps
    document.getElementById("vCreated").innerText = new Date(meeting.created).toLocaleString();
    document.getElementById("vModified").innerText = meeting.lastModified ? new Date(meeting.lastModified).toLocaleString() : 'N/A';

    const vAgenda = document.getElementById("vAgenda");
    vAgenda.innerHTML = "";
    meeting.agenda.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item; // XSS safe
        vAgenda.appendChild(li);
    });

    renderDecisions();
    renderVotes();
    document.getElementById("meetingModal").style.display = "block";
}

function toggleEditMeeting() {
    const form = document.getElementById("meetingEditForm");
    if (form.style.display === "none") {
        const meeting = getCurrentMeeting();
        document.getElementById("editMTitle").value = meeting.title;
        document.getElementById("editMDate").value = meeting.date;
        document.getElementById("editMAgenda").value = meeting.agenda.join('\n');
        form.style.display = "block";
    } else {
        form.style.display = "none";
    }
}

async function updateMeeting() {
    const meeting = getCurrentMeeting();
    const now = new Date().toISOString();
    meeting.title = document.getElementById("editMTitle").value;
    meeting.date = document.getElementById("editMDate").value;
    meeting.agenda = document.getElementById("editMAgenda").value.split('\n').filter(l => l.trim() !== "");
    meeting.lastModified = now;
    getCurrentAssoc().lastModified = now;
    await saveData(associations, sessionPassword);
    viewMeeting(currentMeetingId);
    renderDashboard(false);
}

function renderDecisions() {
    const meeting = getCurrentMeeting();
    const vDecisions = document.getElementById("vDecisions");
    vDecisions.innerHTML = "";
    meeting.decisions.forEach((item, idx) => {
        const text = typeof item === 'string' ? item : item.text;
        const created = item.created ? new Date(item.created).toLocaleString() : 'N/A';
        const modified = item.lastModified ? new Date(item.lastModified).toLocaleString() : null;
        
        const li = document.createElement("li");
        li.innerHTML = `
            <div style="flex:1">
                <span>${escapeHTML(text)}</span><br>
                <small style="color: var(--secondary-color)">Created: ${created} ${modified ? ' | Modified: ' + modified : ''}</small>
            </div>
            <div class="flex-row">
                <button class="secondary" style="padding:4px 8px" onclick="editDecision(${idx})">✏️</button>
                <button class="danger" style="padding:4px 8px" onclick="deleteDecision(${idx})">×</button>
            </div>`;
        vDecisions.appendChild(li);
    });
}

async function editDecision(idx) {
    const meeting = getCurrentMeeting();
    const decision = meeting.decisions[idx];
    const text = typeof decision === 'string' ? decision : decision.text;
    const newText = prompt("Edit Decision:", text);
    if (newText === null || newText.trim() === "") return;

    const now = new Date().toISOString();
    if (typeof decision === 'string') {
        meeting.decisions[idx] = { text: newText, created: now, lastModified: now };
    } else {
        decision.text = newText;
        decision.lastModified = now;
    }
    meeting.lastModified = now;
    getCurrentAssoc().lastModified = now;
    await saveData(associations, sessionPassword);
    renderDecisions();
}

async function deleteDecision(idx) {
    if(confirm("Delete this decision?")) {
        const meeting = getCurrentMeeting();
        const now = new Date().toISOString();
        meeting.decisions.splice(idx, 1);
        meeting.lastModified = now;
        getCurrentAssoc().lastModified = now;
        await saveData(associations, sessionPassword);
        renderDecisions();
    }
}

async function addDecision() {
    const input = document.getElementById("newDecision");
    const decisionText = input.value.trim();
    if (!decisionText) return;
    const now = new Date().toISOString();
    const meeting = getCurrentMeeting();
    meeting.decisions.push({
        text: decisionText,
        created: now
    });
    meeting.lastModified = now;
    getCurrentAssoc().lastModified = now;
    await saveData(associations, sessionPassword);
    renderDecisions();
    input.value = "";
}

function renderVotes() {
    const meeting = getCurrentMeeting();
    const vVotes = document.getElementById("vVotes");
    vVotes.innerHTML = "";
    if (!meeting.votes) meeting.votes = [];
    meeting.votes.forEach((v, idx) => {
        const li = document.createElement("li");
        const created = v.created ? new Date(v.created).toLocaleString() : 'N/A';
        const modified = v.lastModified ? new Date(v.lastModified).toLocaleString() : null;
        
        li.innerHTML = `
            <div style="flex:1">
                <strong>${escapeHTML(v.topic)}:</strong> ${v.yes} Yes, ${v.no} No, ${v.abstain} Abstain<br>
                <small style="color: var(--secondary-color)">Created: ${created} ${modified ? ' | Modified: ' + modified : ''}</small>
            </div>
            <button class="danger" style="padding:4px 8px" onclick="deleteVote(${idx})">×</button>`;
        vVotes.appendChild(li);
    });
}

async function deleteVote(idx) {
    if(confirm("Delete this vote record?")) {
        const meeting = getCurrentMeeting();
        const now = new Date().toISOString();
        meeting.votes.splice(idx, 1);
        meeting.lastModified = now;
        getCurrentAssoc().lastModified = now;
        await saveData(associations, sessionPassword);
        renderVotes();
    }
}

async function recordVote() {
    const topic = document.getElementById("voteTopic").value.trim();
    const yes = parseInt(document.getElementById("voteYes").value) || 0;
    const no = parseInt(document.getElementById("voteNo").value) || 0;
    const abstain = parseInt(document.getElementById("voteAbstain").value) || 0;
    if (!topic) return alert("Topic is required");

    const now = new Date().toISOString();
    const meeting = getCurrentMeeting();
    if (!meeting.votes) meeting.votes = [];
    meeting.votes.push({ topic, yes, no, abstain, created: now });
    meeting.lastModified = now;
    getCurrentAssoc().lastModified = now;
    await saveData(associations, sessionPassword);
    renderVotes();
    document.getElementById("voteTopic").value = "";
    document.querySelectorAll("#votingInterface input[type='number']").forEach(i => i.value = "");
}

// Crypto Helpers (SubtleCrypto)
async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw", encoder.encode(password), 
        { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2", salt: salt,
            iterations: 100000, hash: "SHA-256"
        },
        keyMaterial, { name: "AES-GCM", length: 256 },
        false, ["encrypt", "decrypt"]
    );
}

async function encryptData(password, plainText) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encoded = new TextEncoder().encode(plainText);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    
    return {
        salt: btoa(String.fromCharCode(...salt)),
        iv: btoa(String.fromCharCode(...iv)),
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    };
}

async function decryptData(password, encryptedObj) {
    try {
        const salt = new Uint8Array(atob(encryptedObj.salt).split("").map(c => c.charCodeAt(0)));
        const iv = new Uint8Array(atob(encryptedObj.iv).split("").map(c => c.charCodeAt(0)));
        const data = new Uint8Array(atob(encryptedObj.data).split("").map(c => c.charCodeAt(0)));
        const key = await deriveKey(password, salt);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        return null;
    }
}

// Vault Actions
function openVault() {
    document.getElementById("vaultPassword").value = "";
    document.getElementById("vaultAuthView").style.display = "block";
    document.getElementById("vaultContentView").style.display = "none";
    document.getElementById("vaultModal").style.display = "block";
}

function closeVault() {
    document.getElementById("vaultModal").style.display = "none";
    document.getElementById("vaultPassword").value = "";
}

async function unlockVault() {
    const pass = document.getElementById("vaultPassword").value;
    const correctPass = sessionPassword || "";
    if (pass !== correctPass) return alert("Incorrect Database Encryption Key");

    document.getElementById("vaultAuthView").style.display = "none";
    document.getElementById("vaultContentView").style.display = "block";
    renderVaultRecords();
}

function renderVaultRecords() {
    const assoc = getCurrentAssoc();
    const list = document.getElementById("vaultRecordList");
    list.innerHTML = "";
    if (!assoc.vault) assoc.vault = [];

    assoc.vault.forEach((record, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `<div><strong>${escapeHTML(record.title)}</strong><br><small>Sealed: ${record.date}</small></div>
                        <div class="flex-row">
                            <button onclick="viewVaultRecord(${idx})">View</button>
                            <button class="danger" onclick="deleteVaultRecord(${idx})">Delete</button>
                        </div>`;
        list.appendChild(li);
    });
}

async function viewVaultRecord(idx) {
    const pass = document.getElementById("vaultPassword").value;
    const record = getCurrentAssoc().vault[idx];
    const plain = await decryptData(pass, record.encrypted);
    if (!plain) return alert("Failed to decrypt record.");

    // Simple view as modal text for now
    alert(`--- ${record.title} ---\n\n${plain}`);
}

async function deleteVaultRecord(idx) {
    if (confirm("Permanently delete this record?")) {
        getCurrentAssoc().vault.splice(idx, 1);
        await saveData(associations, sessionPassword);
        renderVaultRecords();
    }
}

async function sealCurrentMembers() {
    const pass = document.getElementById("vaultPassword").value;
    const assoc = getCurrentAssoc();
    const data = JSON.stringify(assoc.members, null, 2);
    const encrypted = await encryptData(pass, data);
    
    if (!assoc.vault) assoc.vault = [];
    assoc.vault.push({
        title: "Member List Snapshot",
        date: new Date().toLocaleString(),
        encrypted: encrypted
    });
    
    await saveData(associations, sessionPassword);
    renderVaultRecords();
    alert("Current member list sealed in vault.");
}

async function sealCurrentBylaws() {
    const pass = document.getElementById("vaultPassword").value;
    const assoc = getCurrentAssoc();
    const bylaws = assoc.customStadgar || generateBylaws(assoc);
    const encrypted = await encryptData(pass, bylaws);
    
    if (!assoc.vault) assoc.vault = [];
    assoc.vault.push({
        title: "Bylaws Snapshot",
        date: new Date().toLocaleString(),
        encrypted: encrypted
    });
    
    await saveData(associations, sessionPassword);
    renderVaultRecords();
    alert("Current bylaws sealed in vault.");
}

// GitHub Integration

function connectGitHub() {
    const token = document.getElementById("githubTokenInput").value.trim();
    if (!token) return alert("Please enter a GitHub Personal Access Token.");

    sessionGitHubToken = token;
    ghGetUser().then(user => {
        if (!user) {
            sessionGitHubToken = null;
            alert("Invalid token or GitHub API error. Check your PAT and try again.");
            return;
        }
        sessionGitHubUser = user.login;
        document.getElementById("githubStatus").innerHTML =
            `<span class="github-status connected"></span> Connected as <strong>@${escapeHTML(user.login)}</strong>`;
        document.getElementById("githubTokenInput").value = "";
        renderDashboard(false);
    }).catch(e => {
        sessionGitHubToken = null;
        alert("Connection failed: " + e.message);
    });
}

function disconnectGitHub() {
    sessionGitHubToken = null;
    sessionGitHubUser = null;
    document.getElementById("githubStatus").innerHTML =
        '<span class="github-status"></span> Not connected';
    document.getElementById("githubTokenInput").value = "";
}

function openGitHubSetup(assoc) {
    if (!assoc) assoc = getCurrentAssoc();
    if (!assoc) return;

    // Pre-fill if already connected
    if (assoc.github) {
        document.getElementById("ghRepoName").value = assoc.github.repo;
        document.getElementById("ghOrgName").value = assoc.github.owner === sessionGitHubUser ? "" : assoc.github.owner;
        document.querySelector('input[name="ghAction"][value="connect"]').checked = true;
    } else {
        document.getElementById("ghRepoName").value = assoc.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        document.getElementById("ghOrgName").value = "";
        document.querySelector('input[name="ghAction"][value="create"]').checked = true;
    }
    document.getElementById("githubSetupModal").style.display = "block";
}

function closeGitHubSetup() {
    document.getElementById("githubSetupModal").style.display = "none";
}

async function connectAssocToGitHub() {
    const assoc = getCurrentAssoc();
    if (!assoc) return;

    const action = document.querySelector('input[name="ghAction"]:checked').value;
    const repoName = document.getElementById("ghRepoName").value.trim();
    const orgInput = document.getElementById("ghOrgName").value.trim();
    const owner = orgInput || sessionGitHubUser;

    if (!repoName) return alert("Repo name is required.");
    if (!owner) return alert("Could not determine owner. Make sure you are connected to GitHub.");

    const btn = document.getElementById("ghSetupConfirmBtn");
    btn.disabled = true;
    btn.textContent = "Working...";

    try {
        if (action === "create") {
            const existing = await ghCheckRepo(owner, repoName);
            if (existing) {
                if (!confirm(`Repo ${owner}/${repoName} already exists. Connect to it anyway?`)) {
                    btn.disabled = false;
                    btn.textContent = "Confirm";
                    return;
                }
            } else {
                await ghCreateRepo(orgInput || null, repoName, assoc.purpose || "");
                // Brief pause for GitHub to initialize the repo
                await new Promise(r => setTimeout(r, 1500));
            }
        } else {
            const existing = await ghCheckRepo(owner, repoName);
            if (!existing) {
                btn.disabled = false;
                btn.textContent = "Confirm";
                return alert(`Repo ${owner}/${repoName} not found. Check the name and try again.`);
            }
        }

        await ghEnablePages(owner, repoName);

        assoc.github = { owner, repo: repoName, branch: "main" };
        await saveData(associations, sessionPassword);

        closeGitHubSetup();
        renderDashboard(false);
        alert(`Connected to ${owner}/${repoName}! GitHub Pages may take a minute to activate.`);
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Confirm";
    }
}

function disconnectAssocFromGitHub() {
    const assoc = getCurrentAssoc();
    if (!assoc) return;
    if (!confirm("Disconnect this association from GitHub? (The repo will not be deleted)")) return;
    delete assoc.github;
    saveData(associations, sessionPassword).then(() => renderDashboard(false));
}

function openPublishModal() {
    const assoc = getCurrentAssoc();
    if (!assoc || !assoc.github) return;

    document.getElementById("publishPhase1").style.display = "block";
    document.getElementById("publishPhase2").style.display = "none";
    document.getElementById("publishPhase3").style.display = "none";

    const pagesUrl = `https://${assoc.github.owner}.github.io/${assoc.github.repo}/`;
    document.getElementById("publishPagesUrl").href = pagesUrl;
    document.getElementById("publishPagesUrl").textContent = pagesUrl;
    document.getElementById("publishRepoInfo").textContent = `${assoc.github.owner}/${assoc.github.repo}`;

    // Reset checkboxes
    document.getElementById("pubFileIndex").checked = true;
    document.getElementById("pubFileReadme").checked = false;
    document.getElementById("pubFileData").checked = false;

    document.getElementById("publishModal").style.display = "block";
}

function closePublishModal() {
    document.getElementById("publishModal").style.display = "none";
}

function showPublishPreview() {
    const assoc = getCurrentAssoc();
    if (!assoc) return;

    const includeIndex = document.getElementById("pubFileIndex").checked;
    const includeReadme = document.getElementById("pubFileReadme").checked;
    const includeData = document.getElementById("pubFileData").checked;

    if (!includeIndex && !includeReadme && !includeData) {
        return alert("Select at least one file to publish.");
    }

    const previewContainer = document.getElementById("publishPreviewContainer");
    previewContainer.innerHTML = "";

    if (includeIndex) {
        const content = generatePublicSite(assoc);
        previewContainer.innerHTML += `
            <details class="preview-file">
                <summary>index.html — Public website</summary>
                <pre>${escapeHTML(content.substring(0, 2000))}${content.length > 2000 ? '\n... (truncated)' : ''}</pre>
            </details>`;
    }
    if (includeReadme) {
        const content = generateReadme(assoc);
        previewContainer.innerHTML += `
            <details class="preview-file">
                <summary>README.md — Repository overview</summary>
                <pre>${escapeHTML(content)}</pre>
            </details>`;
    }
    if (includeData) {
        const content = generatePublicDataSnapshot(assoc);
        previewContainer.innerHTML += `
            <details class="preview-file">
                <summary>data.json — Public metadata (no members, no vault)</summary>
                <pre>${escapeHTML(content)}</pre>
            </details>`;
    }

    document.getElementById("publishPhase1").style.display = "none";
    document.getElementById("publishPhase2").style.display = "block";
}

function backToPublishPhase1() {
    document.getElementById("publishPhase1").style.display = "block";
    document.getElementById("publishPhase2").style.display = "none";
}

async function confirmPublish() {
    const assoc = getCurrentAssoc();
    if (!assoc || !assoc.github) return;

    const { owner, repo } = assoc.github;
    const includeIndex = document.getElementById("pubFileIndex").checked;
    const includeReadme = document.getElementById("pubFileReadme").checked;
    const includeData = document.getElementById("pubFileData").checked;

    document.getElementById("publishPhase2").style.display = "none";
    document.getElementById("publishPhase3").style.display = "block";

    const log = document.getElementById("publishLog");
    log.innerHTML = "";

    function logLine(msg, ok = true) {
        const p = document.createElement("p");
        p.style.margin = "4px 0";
        p.style.color = ok ? "inherit" : "#dc3545";
        p.textContent = msg;
        log.appendChild(p);
    }

    const files = [];
    if (includeIndex) files.push({ path: "index.html", content: generatePublicSite(assoc) });
    if (includeReadme) files.push({ path: "README.md", content: generateReadme(assoc) });
    if (includeData) files.push({ path: "data.json", content: generatePublicDataSnapshot(assoc) });

    let success = true;
    for (const f of files) {
        logLine(`Uploading ${f.path}...`);
        try {
            await ghPutFile(owner, repo, f.path, f.content);
            logLine(`✓ ${f.path} uploaded.`);
        } catch (e) {
            logLine(`✗ ${f.path} failed: ${e.message}`, false);
            success = false;
        }
    }

    const pagesUrl = `https://${owner}.github.io/${repo}/`;
    if (success) {
        logLine(`\nAll files uploaded successfully!`);
        document.getElementById("publishResultUrl").href = pagesUrl;
        document.getElementById("publishResultUrl").textContent = pagesUrl;
        document.getElementById("publishResultSection").style.display = "block";
    } else {
        logLine(`\nSome files failed. Check errors above.`, false);
    }
}

window.onload = init;
