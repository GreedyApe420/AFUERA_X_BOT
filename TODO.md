# ✅ TODO — Projet AFUERA BOT

Un bot Twitter sarcastique, libre et autonome.

---

## ✅ À faire prochainement

- [ ] Vérifier régulièrement que le token d’accès (`X_ACCESS_TOKEN`) se régénère bien via le `refresh_token`.
  - Ajouter des logs explicites.
  - Enregistrer le nouveau token dans `.env` si différent de l’actuel.

- [ ] Ajouter un mode « pause manuelle » dans le `.env` (ex: `PAUSE_BOT=true`)
  - Si activé, le bot se met en veille sans quitter le programme.

- [ ] Poster deux trois tweets de temps en temps
  - Et pourquoi pas avoir un vrai fichier de conf à la place du `.env` (nb tweet par jour / plage horaire etc...)

- [ ] Optimiser les délais de poling
  - analyser la doc et déterminer les délais les plus opti

- [ ] Ajouter la possibilité de retweeter et liker certains tweets aléatoirement :
  - Sur 1 tweet sur 10, retweeter ou liker selon un petit algorithme random.
  - Objectif : faire paraître le bot plus humain et actif.

- [ ] Implémenter une page simple `/status` (via Express ou HTTP natif)
  - Afficher nombre de réponses envoyées, dernier tweet traité, état du token, etc.

---

## 💡 Idées bonus à explorer plus tard

- [ ] Générer des images avec DALL·E et les poster sous forme de meme (s’il y a un mot-clé ou contexte visuel).
- [ ] Créer une base de données de punchlines personnalisées (humaines) à mixer avec l’IA.
- [ ] invocation via en le citant via @AFUERA_BOT sur X
- [ ] Fonction "anti-boomer" : détecter certains mots-clés typiques et répondre de façon plus edgy 😈
- [ ] Analyse de sentiment des tweets initiaux pour ajuster le ton.

---

## 🤝 Contributions

Les PR sont bienvenues : humour, AI, prompt engineering, ou hacks de contournement de l’API.
