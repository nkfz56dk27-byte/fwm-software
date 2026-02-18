# Filtro Categoria per Feed RSS

## Modifiche Implementate

Ho implementato un sistema di filtro per categoria nei feed RSS, simile a quello già presente in "Disponibilità Weekend".

### 1. Database - Migration SQL

**File:** `db/0017_add_categoria_to_rss_feeds.sql`

Questa migration aggiunge una colonna `categoria_id` alla tabella `rss_feeds` che permette di assegnare una categoria a ciascun feed.

**Per applicare la migration su Supabase:**
1. Vai su Supabase Dashboard
2. Vai in SQL Editor
3. Copia e incolla il contenuto del file `db/0017_add_categoria_to_rss_feeds.sql`
4. Esegui la query

### 2. Gestione RSS Modal

**File:** `src/GestioneRSSModal.jsx`

Modifiche:
- Aggiunto dropdown per selezionare la categoria quando si aggiunge un feed
- Mostra la categoria assegnata per ogni feed nella lista
- Se non si seleziona una categoria, il feed sarà visibile a tutti (categoria_id = NULL)

### 3. Pannello Fonti

**File:** `src/PannelloFonti.jsx`

Modifiche:
- Carica le categorie dell'utente all'avvio
- Filtra i feed RSS mostrati in base alle categorie dell'utente:
  - Se l'utente ha categorie assegnate: mostra feed con `categoria_id = NULL` + feed delle sue categorie
  - Se l'utente non ha categorie: mostra solo feed con `categoria_id = NULL`
- Applica lo stesso filtro a tutte le query che caricano articoli

## Come Funziona

### Per l'Amministratore (Gestione RSS)

1. Vai in "Gestione" → "Gestisci RSS"
2. Quando aggiungi un nuovo feed:
   - Inserisci l'URL del feed
   - Seleziona la categoria (es. "Formula 1", "Formula E", ecc.)
   - Se lasci "Tutte le categorie", il feed sarà visibile a tutti
3. I feed esistenti mostreranno la categoria assegnata

### Per gli Utenti

1. Vai in "Pannello Fonti" o "Aggiungi Feed"
2. Vedrai solo i feed che:
   - Non hanno categoria (sono per tutti)
   - Appartengono alle tue categorie assegnate

**Esempio:**
- Utente in categoria "Formula 1": vede tutti i feed generali + feed di Formula 1
- Utente anche in "Formula E": vede feed generali + Formula 1 + Formula E
- Utente senza categoria: vede solo i feed generali

## Note Tecniche

- I feed con `categoria_id = NULL` sono sempre visibili a tutti
- Il filtro viene applicato automaticamente a tutte le query che caricano feed e articoli
- La logica è coerente con quella già implementata in "Disponibilità Weekend"
