# Differenza tabelle push

- push_notifications: tabella usata per pipeline OneSignal (quella che vuoi usare ora)
- notifiche_push: tabella legacy, usata per pipeline vecchia (non OneSignal)

## push_notifications (OneSignal)
- id (serial/bigserial)
- title (text)
- body (text)
- notification_type (text)
- target_all (boolean)
- target_users (text[])
- data (jsonb)
- status (text)
- created_at (timestamp)

## notifiche_push (legacy)
- id (uuid)
- destinatario (text)
- titolo (text)
- messaggio (text)
- url (text)
- data (jsonb)
- letta (boolean)
- created_at (timestamp)

## Pipeline corretta
- Frontend e backend devono usare push_notifications per OneSignal.
- NOT usare notifiche_push per pipeline OneSignal.

## Prossimi step
- Confermo che push_notifications esiste e ha i campi giusti.
- Mi assicuro che insert e script usino push_notifications.
- Se serve, ti do query per vedere lo stato delle notifiche in push_notifications.
