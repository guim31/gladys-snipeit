# Snipe-IT

Suivez votre inventaire [Snipe-IT](https://snipeitapp.com/) dans Gladys : les
garanties et licences qui expirent bientôt, le matériel prêté et celui
attendu en retour, les consommables qui s'épuisent, les audits et les
maintenances. Tout reste sur votre réseau local : Gladys parle directement à
votre serveur Snipe-IT, et ne fait que le lire.

Testé sur un vrai serveur Snipe-IT 8.8.1 (l'image Docker officielle). Vos
retours sont les bienvenus sur le forum de Gladys.

## Prérequis

- Gladys Assistant 5.1 ou plus récent.
- Un serveur Snipe-IT (version 6 ou plus récente) joignable depuis la machine
  de Gladys.
- Un jeton d'API personnel : dans Snipe-IT, ouvrez le menu de votre profil (en
  haut à droite), **Gérer les clés d'API**, puis **Créer un nouveau jeton**, et
  copiez-le tout de suite (il ne s'affiche qu'une fois). L'utilisateur du jeton
  doit au moins pouvoir voir les matériels ; les licences, consommables et
  maintenances sont lus s'il a le droit de les voir.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Dans **Adresse de Snipe-IT**, saisissez l'adresse que vous ouvrez dans
   votre navigateur, par exemple `http://192.168.1.50` ou
   `https://snipeit.example.org`.
3. Collez le **jeton d'API**.
4. **Garantie qui expire dans (jours)** : une garantie compte comme bientôt
   expirée ce nombre de jours avant sa fin (30 par défaut).
5. **Licence qui expire dans (jours)** : la même chose pour les licences (30
   par défaut).
6. **Lire Snipe-IT toutes les** : 15 minutes, 30 minutes, 1 heure (par
   défaut), 3 ou 6 heures.
7. **Langue des noms et des messages** fixe les noms des fonctionnalités (figés
   à l'ajout de l'appareil), les textes et les dates des variables de scène.
   Français par défaut.
8. Enregistrez, puis utilisez **Tester la connexion** : elle affiche la
   version de Snipe-IT et le nombre de matériels et de licences.
9. Dans l'onglet **Découverte**, ajoutez l'appareil **Snipe-IT**.

## Appareils

**Snipe-IT** (un appareil pour votre inventaire) :

| Fonctionnalité             | Valeur                                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| Matériels                  | nombre de matériels (Snipe-IT écarte les archivés)                          |
| Matériels prêtés           | matériels attribués à un utilisateur, un emplacement ou un autre matériel   |
| Garanties bientôt expirées | matériels dont la garantie finit dans la fenêtre réglée                     |
| Licences bientôt expirées  | licences dont la date d'expiration tombe dans la fenêtre réglée             |
| Consommables sous le seuil | consommables à leur quantité minimale ou en dessous (minimum supérieur à 0) |
| Audits en retard           | matériels dont la date du prochain audit est passée                         |
| Retours en retard          | matériels prêtés dont la date de retour prévue est passée                   |
| Maintenances en cours      | maintenances commencées et pas terminées                                    |
| Prochaine échéance         | type, nom et date de la prochaine échéance de la semaine, ou « Aucune »     |

Les garanties et licences déjà expirées ne sont pas comptées. Si le jeton n'a
pas le droit de voir les licences ou les consommables, leurs fonctionnalités
restent sans valeur.

## Widget de tableau de bord

**Échéances Snipe-IT** : quatre tuiles (matériels, prêtés, garanties et
licences qui expirent, consommables en stock bas) et les échéances des sept
prochains jours, ce qui est en retard d'abord (en rouge). Sans le droit de voir
les consommables, la tuile du stock bas n'apparaît pas : retours prévus,
audits, fins prévues des maintenances, garanties et licences qui expirent.
Lecture seule.

## Déclencheurs de scène

- **Garantie qui expire** : la garantie d'un matériel entre dans la fenêtre
  réglée. Une fois par matériel et date de fin. Variables : matériel, numéro
  d'inventaire, modèle, date de fin, jours restants.
- **Licence qui expire** : une licence entre dans la fenêtre réglée. Une fois
  par licence et date. Variables : licence, postes, date d'expiration, jours
  restants.
- **Consommable sous le seuil** : un consommable descend à sa quantité minimale
  ou en dessous. De nouveau annoncé après un réassort au-dessus. Variables :
  consommable, restant, minimum.
- **Retour en retard** : un matériel prêté dépasse sa date de retour prévue.
  Une fois par prêt. Variables : matériel, numéro d'inventaire, prêté à, retour
  prévu, jours de retard.

La première lecture après l'installation est silencieuse : ce qui est déjà en
attente se voit sur l'appareil, sans être annoncé. Les déclencheurs partent à
la première lecture qui suit le changement (après minuit, dans l'intervalle
réglé).

## Actions de scène

**Lire les échéances de la semaine** : lit Snipe-IT et renvoie **Échéances**
(le nombre d'échéances des sept prochains jours et de ce qui est en retard),
**En retard** et **Texte du résumé**, une phrase prête à envoyer ou à dire,
par exemple « 3 échéance(s) dans Snipe-IT : Retour Laptop Bob (2 jour(s) de
retard), Licence Antivirus (22/10/2026), Garantie Home server (25/10/2026). »

## Exemples de scènes

- **Point du lundi** : chaque lundi à 9 h → « Lire les échéances de la
  semaine » → continuer seulement si le nombre d'échéances est supérieur à 0 →
  envoyer le texte du résumé en message.
- **Rappel de prêt** : déclencheur « Retour en retard » → message
  « {{triggerEvent.data.asset}} devait revenir de chez
  {{triggerEvent.data.assigned_to}} le {{triggerEvent.data.expected}} ».
- **Liste de courses** : déclencheur « Consommable sous le seuil » → message
  « Plus que {{triggerEvent.data.remaining}} {{triggerEvent.data.consumable}} ».

## Dépannage

- **« Jeton refusé »** : le jeton a été révoqué, a expiré ou n'a pas été collé
  en entier. Créez-en un nouveau.
- **« L'utilisateur de ce jeton ne peut pas voir les matériels »** : donnez à
  l'utilisateur le droit « Voir » sur les matériels dans Snipe-IT, et vérifiez
  qu'il est activé.
- **« Snipe-IT ne répond pas »** : vérifiez l'adresse depuis la machine de
  Gladys. Le conteneur est sur un réseau en pont : `localhost` désigne le
  conteneur lui-même, saisissez plutôt l'adresse IP du serveur.
- **« Cette adresse ne répond pas comme Snipe-IT »** : une page de connexion
  d'un proxy répond à sa place, ou l'adresse n'est pas celle de Snipe-IT
  (vérifiez `APP_URL` et le chemin derrière un proxy inverse).
- Pour en voir plus dans les journaux de l'intégration, réglez
  `LOG_LEVEL=debug`.

## Limites

- Lecture seule : l'intégration ne modifie jamais votre inventaire.
- Chaque lecture fait au moins quatre requêtes (matériels, licences,
  consommables, maintenances, 500 lignes par requête), très en dessous de la
  limite de l'API de Snipe-IT (120 requêtes par minute par défaut).
- Un serveur Snipe-IT par intégration. Les composants et accessoires ne sont
  pas suivis.
- Sans lien avec Grokability ni le projet Snipe-IT.
