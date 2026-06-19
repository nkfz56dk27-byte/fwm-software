const dotenv = require('dotenv');
dotenv.config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

supabase
  .from('push_notifications_rss_filter')
  .select('id,title,status,error,target_users,created_at')
  .order('created_at', { ascending: false })
  .limit(1)
  .then(({ data, error }) => {
    console.log('Ultima notifica:', data);
    if (error) console.error('Errore:', error);
    process.exit(0);
  });
