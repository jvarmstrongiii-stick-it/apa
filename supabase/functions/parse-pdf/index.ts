import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.0';

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify caller is admin
    const { data: { user: caller } } = await supabaseClient.auth.getUser();
    if (!caller) throw new Error('Unauthorized');

    const { data: callerProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfile?.role !== 'admin') throw new Error('Only admins can import scoresheets');

    const { importId, storagePath } = await req.json();
    if (!importId || !storagePath) throw new Error('Missing required fields');

    // Update import status to processing
    await supabaseAdmin
      .from('imports')
      .update({ status: 'processing' })
      .eq('id', importId);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('imports')
      .download(storagePath);

    if (downloadError) throw downloadError;

    // Extract text from PDF
    // Note: In production, you'd use pdf-parse or an OCR API here.
    // For now, we'll implement a basic text extraction placeholder.
    const pdfText = await extractPDFText(fileData);

    // Parse the scoresheet data
    const parsedRows = parseAPAScoresheet(pdfText);

    // Validate and insert rows
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        // Validate row data
        validateRow(row);

        // Insert import row as success
        await supabaseAdmin.from('import_rows').insert({
          import_id: importId,
          row_number: i + 1,
          status: 'success',
          raw_data: row,
        });
        successCount++;
      } catch (error) {
        await supabaseAdmin.from('import_rows').insert({
          import_id: importId,
          row_number: i + 1,
          status: 'error',
          raw_data: row,
          error_message: error.message,
        });
        errorCount++;
      }
    }

    // Update import with final counts
    await supabaseAdmin
      .from('imports')
      .update({
        status: 'completed',
        total_rows: parsedRows.length,
        success_count: successCount,
        error_count: errorCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importId);

    return new Response(
      JSON.stringify({
        success: true,
        totalRows: parsedRows.length,
        successCount,
        errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

// Placeholder for PDF text extraction
// In production, use pdf-parse for digital PDFs or an OCR API for scanned
async function extractPDFText(blob: Blob): Promise<string> {
  // TODO: Integrate pdf-parse or OCR service
  // For now, try to extract raw text content
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Simple text extraction from PDF (handles basic digital PDFs)
  let text = '';
  let inText = false;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 40) { // '(' - start of text string
      inText = true;
      continue;
    }
    if (bytes[i] === 41) { // ')' - end of text string
      inText = false;
      text += ' ';
      continue;
    }
    if (inText && bytes[i] >= 32 && bytes[i] <= 126) {
      text += String.fromCharCode(bytes[i]);
    }
  }

  return text;
}

// Parse APA scoresheet layout
interface ParsedRow {
  homePlayer?: string;
  awayPlayer?: string;
  homeSkillLevel?: number;
  awaySkillLevel?: number;
  homeGamesWon?: number;
  awayGamesWon?: number;
  innings?: number;
  defensiveShots?: number;
  matchOrder?: number;
  format?: string;
  [key: string]: unknown;
}

function parseAPAScoresheet(text: string): ParsedRow[] {
  // TODO: Implement template matching for known APA scoresheet layouts
  // This is a placeholder that returns an empty array
  // Real implementation would:
  // 1. Identify scoresheet format (8-ball vs 9-ball)
  // 2. Extract header info (teams, date, league)
  // 3. Extract each individual match row
  // 4. Extract rack-level data

  const rows: ParsedRow[] = [];

  // Basic pattern matching for common APA scoresheet formats
  const lines = text.split(/\s+/);
  // Pattern detection would go here

  return rows;
}

function validateRow(row: ParsedRow): void {
  if (!row.homePlayer || !row.awayPlayer) {
    throw new Error('Missing player names');
  }
  if (row.homeSkillLevel !== undefined && (row.homeSkillLevel < 1 || row.homeSkillLevel > 9)) {
    throw new Error(`Invalid home skill level: ${row.homeSkillLevel}`);
  }
  if (row.awaySkillLevel !== undefined && (row.awaySkillLevel < 1 || row.awaySkillLevel > 9)) {
    throw new Error(`Invalid away skill level: ${row.awaySkillLevel}`);
  }
}
