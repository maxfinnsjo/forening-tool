"Plan: Make a tool for initializing and "shipping" associations, in Swedish Föreningar, from Idea to generate from template with custom data the structure, i.e stadgar, medlemsregister, planering / schema, styrelse, skick (typ av förening, org nummer eller möjlighet att generera ansökan att skicka med post till skatteverket) generate basic association in it most basic form (tre medlemmar med uttalat syfte), to the most developed form of ekonomisk förening with registrered organisations nummer från skatteverket, and with the tool generate it, publish it to an app basic html site on something like github pages as a simple info and contact public display, keep the medlemsregister and stadgar for reference and ledger purposes, with info on when to vote, how to vote, what rules are for decisions and what happens in disagreements and so on."

a first foundation: extremely simple, no backend, runs everywhere, and works on static hosting like GitHub Pages.

We'll build a minimal foundation that you can expand later.

Design goals:

zero dependencies

static hosting

simple architecture

easy to extend

human-readable data

1. Project Structure

Start with something extremely small.

forening-tool/

index.html
app.js
storage.js
templates.js
styles.css

Optional later:

/templates
/public-site-generator
/pdf-generator
2. Data Model

We store one association object in LocalStorage.

Example structure:

{
  "name": "",
  "type": "ideell",
  "purpose": "",
  "created": "",
  "members": [],
  "board": {
    "chair": "",
    "treasurer": "",
    "secretary": ""
  },
  "meetings": [],
  "motions": []
}

Key in LocalStorage:

forening_data
3. index.html

Minimal UI to create an association.

Writing

Name



Purpose

Create

Add Member
Export Data
Reset

4. storage.js

Handles LocalStorage.

Writing

const STORAGE_KEY = "forening_data"

function saveData(data){
localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function loadData(){
const raw = localStorage.getItem(STORAGE_KEY)
if(!raw) return null
return JSON.parse(raw)
}

function clearData(){
localStorage.removeItem(STORAGE_KEY)
}

5. templates.js

Defines the default association template.

Writing

function createAssociationTemplate(name, purpose, members){

return {

name: name,

type: "ideell",

purpose: purpose,

created: new Date().toISOString(),

members: members.map(m => ({
name: m,
joined: new Date().toISOString(),
role: "member"
})),

board: {
chair: members[0],
treasurer: members[1],
secretary: members[2]
},

meetings: [],

motions: []

}

}

6. app.js

Main logic.

Writing

let association = null

function createAssociation(){

const name = document.getElementById("name").value
const purpose = document.getElementById("purpose").value

const memberInputs = document.querySelectorAll(".member")

const members = []

memberInputs.forEach(i=>{
if(i.value.trim() !== ""){
members.push(i.value.trim())
}
})

if(members.length < 3){
alert("Minimum 3 members required")
return
}

association = createAssociationTemplate(name,purpose,members)

saveData(association)

renderDashboard()
}

function renderDashboard(){

association = loadData()

if(!association) return

document.getElementById("createForm").style.display="none"
document.getElementById("dashboard").style.display="block"

document.getElementById("assocName").innerText = association.name

const list = document.getElementById("memberList")

list.innerHTML=""

association.members.forEach(m => {

const li = document.createElement("li")
li.innerText = m.name + " ("+m.role+")"

list.appendChild(li)

})

}

function addMember(){

const name = prompt("Member name")

if(!name) return

association.members.push({
name: name,
joined: new Date().toISOString(),
role: "member"
})

saveData(association)

renderDashboard()

}

function exportData(){

const dataStr = JSON.stringify(association,null,2)

const blob = new Blob([dataStr],{type:"application/json"})

const a = document.createElement("a")

a.href = URL.createObjectURL(blob)

a.download = "association.json"

a.click()

}

function resetAssociation(){

if(confirm("Delete association?")){
clearData()
location.reload()
}

}

window.onload = renderDashboard

7. styles.css (very minimal)
Writing

body{
font-family: sans-serif;
max-width:700px;
margin;
padding:40px;
}

input,textarea{
width:100%;
margin-bottom:10px;
padding:6px;
}

button{
padding:8px 12px;
margin-right:10px;
}

8. What You Now Have

A working base system that can:

✔ create an association
✔ enforce 3 members
✔ store data locally
✔ display dashboard
✔ export JSON backup

Runs entirely on:

static html
javascript
localStorage

Perfect for deployment on GitHub Pages.

9. Next Logical Features

The next things to add (in order):

1️⃣ Stadgar generator

generate bylaws from template

2️⃣ Meeting system

create meeting
agenda
decisions

3️⃣ Voting

yes / no / abstain

4️⃣ Document export

PDF founding protocol
PDF bylaws

5️⃣ Public site generator

export static info page
10. One Small Improvement I Recommend Immediately

Instead of storing one association, store multiple:

forening_data = [association1, association2]

This makes the tool 10x more useful.

If you'd like, next we can design the core governance engine (motions, votes, meetings) in a way that stays minimal but legally compatible with Swedish associations. It’s actually surprisingly simple.
