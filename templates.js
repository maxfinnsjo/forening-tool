function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function escapeHTML(str) {
    if (!str) return "";
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
}

function safeUrl(url) {
    if (!url) return "#";
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "#";
}

function createAssociationTemplate(name, purpose, members, contact = "", links = [], badge = "", type = "ideell") {
    const now = new Date().toISOString();
    return {
        id: generateId(),
        name: name,
        type: type,
        purpose: purpose,
        contact: contact,
        links: links,
        badge: badge,
        created: now,
        lastModified: now,
        members: members.map((m, index) => {
            let role = "member";
            if (index === 0) role = "chair";
            else if (index === 1) role = "treasurer";
            else if (index === 2) role = "secretary";
            
            return {
                id: generateId(),
                firstName: m.firstName,
                lastName: m.lastName || "",
                phone: m.phone || "",
                email: m.email || "",
                address: m.address || "",
                name: `${m.firstName} ${m.lastName || ""}`.trim(), // Keep full name for board sync
                joined: now,
                lastModified: now,
                role: role
            };
        }),
        board: {
            chair: `${members[0].firstName} ${members[0].lastName || ""}`.trim(),
            treasurer: `${members[1].firstName} ${members[1].lastName || ""}`.trim(),
            secretary: `${members[2].firstName} ${members[2].lastName || ""}`.trim()
        },
        meetings: [],
        motions: [],
        ideas: [],
        vault: []
    };
}

function generateBylaws(assoc) {
    const year = new Date(assoc.created).getFullYear();
    return `STADGAR FÖR ${assoc.name.toUpperCase()}

§ 1. Namn och säte
Föreningens namn är ${assoc.name}. Styrelsen har sitt säte i [ORT].

§ 2. Ändamål
Föreningens ändamål är:
${assoc.purpose}

§ 3. Medlemskap
Medlem i föreningen är den som vill verka för föreningens ändamål och följer dess stadgar.

§ 4. Beslutsfattande
Föreningens högsta beslutande organ är årsmötet. Styrelsen fattar beslut mellan årsmötena.

§ 5. Styrelse
Styrelsen består av:
- Ordförande: ${assoc.board.chair}
- Kassör: ${assoc.board.treasurer}
- Sekreterare: ${assoc.board.secretary}

§ 6. Stadgeändring
För ändring av dessa stadgar krävs beslut på årsmöte.

§ 7. Upplösning
Vid upplösning av föreningen ska dess tillgångar gå till [SYFTE/ORGANISATION].

Dessa stadgar antogs den ${new Date(assoc.created).toLocaleDateString('sv-SE')}.
`;
}

function generateReadme(assoc) {
    const boardLines = [];
    if (assoc.board.chair !== 'Ej angivet') boardLines.push(`- **Ordförande:** ${assoc.board.chair}`);
    if (assoc.board.treasurer !== 'Ej angivet') boardLines.push(`- **Kassör:** ${assoc.board.treasurer}`);
    if (assoc.board.secretary !== 'Ej angivet') boardLines.push(`- **Sekreterare:** ${assoc.board.secretary}`);

    const links = (assoc.links || []).map(l => `- ${l}`).join('\n');
    const badge = assoc.badge ? `\`\`\`\n${assoc.badge}\n\`\`\`` : '';

    return `# ${assoc.name}

${assoc.purpose}

## Kontakt

${assoc.contact || 'Ej angivet'}

${links ? '## Länkar\n\n' + links : ''}

## Styrelse

${boardLines.join('\n') || 'Ej angivet'}

## Medlemmar

${assoc.members.length} registrerade medlemmar.

${badge}

---
*Genererad med [Forening Tool](https://github.com/maxfinnsjo/forening-tool), ${new Date().toLocaleDateString('sv-SE')}*
`;
}

function generatePublicDataSnapshot(assoc) {
    return JSON.stringify({
        id: assoc.id,
        name: assoc.name,
        type: assoc.type,
        purpose: assoc.purpose,
        contact: assoc.contact,
        links: assoc.links,
        badge: assoc.badge,
        created: assoc.created,
        lastModified: assoc.lastModified,
        memberCount: assoc.members.length,
        generatedAt: new Date().toISOString()
    }, null, 2);
}

function generatePublicSite(assoc) {
const linksList = (assoc.links || []).map(l => `<li><a href="${safeUrl(l)}" rel="noopener noreferrer">${escapeHTML(l)}</a></li>`).join('');

// Calculate last active date by finding the latest timestamp
const dates = [assoc.created, assoc.lastModified];
if (assoc.members) assoc.members.forEach(m => dates.push(m.joined, m.lastModified));
if (assoc.meetings) assoc.meetings.forEach(m => {
    dates.push(m.created, m.lastModified || m.created);
    if (m.decisions) m.decisions.forEach(d => dates.push(d.created || m.created));
});

const latestDate = new Date(Math.max(...dates.filter(d => !!d).map(d => new Date(d).getTime())));
const lastActive = latestDate.toLocaleDateString('sv-SE');

return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(assoc.name)} - Information</title>
<style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #fdfdfd; }
    header { border-bottom: 2px solid #007bff; margin-bottom: 40px; padding-bottom: 20px; display: flex; gap: 30px; align-items: center; }
    h1 { margin: 0; color: #007bff; }
    section { margin-bottom: 30px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h2 { border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 0; }
    .purpose { font-style: italic; color: #555; font-size: 1.1em; }
    ul { padding-left: 20px; }
    .badge { font-family: monospace; background: #eee; padding: 10px; border-radius: 4px; line-height: 1; white-space: pre; font-size: 14px; }
    .activity { font-size: 0.85em; color: #666; margin-top: 5px; }
    footer { margin-top: 50px; text-align: center; font-size: 0.9em; color: #777; }
</style>
</head>
<body>
<header>
    <div class="badge">${escapeHTML(assoc.badge || "")}</div>
    <div>
        <h1>${escapeHTML(assoc.name)}</h1>
        <p class="activity">Senast aktiv: ${lastActive}</p>
    </div>
</header>

<section>
    <h2>Vårt ändamål</h2>
    <p class="purpose">${escapeHTML(assoc.purpose)}</p>
</section>

<section>
    <h2>Kontakt & Länkar</h2>
    <p><strong>E-post/Kontakt:</strong> ${escapeHTML(assoc.contact || "Ej angivet")}</p>
    <ul>${linksList}</ul>
</section>

<footer>
    <p>Genererad med <a href="https://github.com/maxfinnsjo/forening-tool">Forening Tool</a> | ${new Date().toLocaleDateString('sv-SE')}</p>
</footer>
</body>
</html>`;
}
