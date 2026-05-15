const STORAGE_KEY = "forening_data";
const SEC_KEY = "forening_sec_meta";

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

async function saveData(data, password = null) {
    const json = JSON.stringify(data);
    
    // If no password, save as plaintext (standard behavior if security not setup)
    if (!password) {
        localStorage.setItem(STORAGE_KEY, json);
        return;
    }

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
        localStorage.setItem(SEC_KEY, "active"); // Mark that we are in secure mode
    } catch (e) {
        console.error("Encryption failed", e);
        alert("Failed to encrypt data!");
    }
}

async function loadData(password = null) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        
        // If data is not marked as encrypted, return as is (for migration)
        if (!parsed.encrypted) return Array.isArray(parsed) ? parsed : [];

        if (!password) return null; // Needs password to proceed

        const salt = new Uint8Array(atob(parsed.salt).split("").map(c => c.charCodeAt(0)));
        const iv = new Uint8Array(atob(parsed.iv).split("").map(c => c.charCodeAt(0)));
        const data = new Uint8Array(atob(parsed.data).split("").map(c => c.charCodeAt(0)));
        
        const key = await deriveKey(password, salt);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
        console.error("Decryption failed", e);
        return null; // Signals wrong password or corruption
    }
}

function clearData() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SEC_KEY);
}

function isStorageEncrypted() {
    return localStorage.getItem(SEC_KEY) === "active";
}
