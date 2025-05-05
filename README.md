# 🤖 AFUERA X BOT

Un bot Twitter (X) autonome qui surveille des comptes, répond automatiquement "AFUERA 🪓" à leurs tweets, et génère des réponses IA aux commentaires. Basé sur l'API v2 de X et OpenAI (GPT).

---

## 📁 Structure du projet

```
AFUERA_X_BOT/
├── accounts.txt              # Liste des handles à surveiller (@ supprimé)
├── .env                      # Variables d'environnement sensibles
├── auth.js                   # Script d'authentification OAuth2 PKCE (token OpenAI + X)
├── main.js                   # Bot principal : boucle de polling + réponses
├── lib/
│   ├── openaiClient.js       # Initialisation client OpenAI
│   └── xApi.js               # Fonctions Twitter (follow, tweet, reply, etc)
├── utils/
│   └── logger.js             # Logger stylé (chalk + dayjs)
└── README.md
```

---

## 🔐 fichier .env (A créer toi même)

```env
X_CLIENT_ID=...              # Depuis portal X
X_CLIENT_SECRET=...          # Si client confidentiel
X_ACCESS_TOKEN=...           # Généré via auth.js
X_REFRESH_TOKEN=...          # Idem
X_SELF_USER_ID=GreedyApe423  # Ton @ handle sans @
OPENAI_API_KEY=sk-...        # Ton token OpenAI
POLL_INTERVAL_MS=120000      # Délai en ms entre chaque boucle (par défaut: 2min)
```

---

## ✅ Prérequis

* Node.js v20+
* Un compte Twitter Developer avec **OAuth 2.0 PKCE activé**
* Un client OpenAI (GPT-3.5 ou 4)

---

## 🚀 Lancer le bot

### 1. Cloner & installer

```bash
git clone https://github.com/GreedyApe420/AFUERA_X_BOT.git
cd AFUERA_X_BOT
npm install
```

### 2. Ajouter les handles dans `accounts.txt`

```
GreedyApe420
elonmusk
@OpenAI     # Les @ seront supprimés automatiquement
```

### 3. Récupérer les tokens OAuth2

```bash
node auth.js
```

* Ouvre une URL, se connecte à X et autorise l'appli.
* Les tokens seront écrits dans `.env`

### 4. Lancer le bot

```bash
node main.js
```

---

## ⚙️ Fonctionnement

### ✅ Suivi de comptes

* Appelle `GET /users/by/username`
* Suit les comptes via `POST /users/:id/following` (facultatif)

### 🔄 Polling de tweets

* Appelle `GET /users/:id/tweets`
* Ignore réponses/retweets
* Mémorise le dernier tweet vu (in-memory)

### 🔧 Réaction au tweet

* Répond instantanément: `AFUERA 🪓`
* Cherche les réponses (replies): `GET /tweets/search/recent`
* Pour chaque reply :

  * Envoie à GPT-4 via `openaiClient.generateResponse()`
  * Répond à la reply (avec `replyToTweet()`) (désactivé à cause des limites API)

---

## ⏱ Antispam & Rate Limits

| Action             | Endpoint               | Délai imposé |
| ------------------ | ---------------------- | ------------ |
| Lire tweets        | GET /users/\:id/tweets | 5 sec        |
| Lire réponses      | GET /tweets/search     | 5 sec        |
| Poster une réponse | POST /tweets           | 45 sec       |

* Géré avec **Bottleneck** + Group par user.
* Chaque type de requête a sa propre file.
* Le polling est répété toutes les 2 minutes (modifiable).

---

## 🧠 OpenAI

* Utilise GPT-4 ou GPT-3.5
* Appelle `generateResponse(replyText)` pour chaque réponse utilisateur (désactivé)
* Répond avec humour/sarcasme selon les prompts (configurable).

---

## 🧪 Déploiement VPS

* Lancer `auth.js` en local avec tunnel ou domaine configuré dans `Callback URL`
* Puis copier `.env` sur VPS
* Lancer `node main.js` sur le VPS via `pm2`, `screen` ou `nohup`

```bash
pm install -g pm2
pm2 start main.js --name afuera-bot
```

---

## 🔒 Sécurité

* `.env` doit être dans `.gitignore`
* Les tokens ont une durée de 2h, mais le `refresh_token` permet de renouveler sans repasser par l'auth
* Le script d’auth gère tout automatiquement

---

## 📄 Licence

MIT

---

## 👑 Auteur

* Créateur : [@GreedyApe420](https://twitter.com/GreedyApe420)
* Projet AFUERA™ ✖
* Pour toute question : DM ou issue GitHub
