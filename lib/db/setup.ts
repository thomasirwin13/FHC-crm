import { promises as fs } from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';


function question(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function getSupabaseURL(): Promise<string> {
  console.log('Step 1: Setting up Supabase');
  console.log(
    'You can create a Supabase project at: https://supabase.com/dashboard'
  );
  return await question('Enter your NEXT_PUBLIC_SUPABASE_URL: ');
}

async function getSupabaseAnonKey(): Promise<string> {
  return await question('Enter your NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ');
}

async function getSupabaseSecretKey(): Promise<string> {
  return await question('Enter your SUPABASE_SECRET_KEY: ');
}

async function writeEnvFile(envVars: Record<string, string>) {
  console.log('Step 2: Writing environment variables to .env');
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  await fs.writeFile(path.join(process.cwd(), '.env'), envContent);
  console.log('.env file created with the necessary variables.');
}

async function main() {
  const NEXT_PUBLIC_SUPABASE_URL = await getSupabaseURL();
  const NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = await getSupabaseAnonKey();
  const SUPABASE_SECRET_KEY = await getSupabaseSecretKey();
  const BASE_URL = 'http://localhost:3000';

  await writeEnvFile({
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    SUPABASE_SECRET_KEY,
    BASE_URL,
  });

  console.log('🎉 Setup completed successfully!');
}

main().catch(console.error);
