const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the migration file
const migrationSql = fs.readFileSync('server/migrations/002_new_supabase_schema_adv01_adv03.sql', 'utf-8');

// Split by semicolon and execute statements one by one
const statements = migrationSql.split(';').filter(s => s.trim());

console.log(`Running ${statements.length} SQL statements...`);

async function runMigration() {
  try {
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      console.log(`[${i + 1}/${statements.length}] Executing...`);
      
      const { error } = await supabase.rpc('exec', { sql: statement });
      
      if (error) {
        console.error(`Error on statement ${i + 1}:`, error);
      }
    }
    console.log('✅ Migration completed!');
  } catch (err) {
    console.error('Fatal error:', err);
  }
}

runMigration();
