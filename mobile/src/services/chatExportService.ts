/**
 * chatExportService — Saves AI chat conversations to timestamped text files on device.
 */
import { Paths, File, Directory } from 'expo-file-system';
import { Alert } from 'react-native';

export async function saveAIChatToFile(
  messages: Array<{ role: string; text: string; date?: string }>,
  label: string,
): Promise<string | null> {
  try {
    const dir = new Directory(Paths.document!, 'ai_chats');
    if (!(await dir.exists)) {
      await dir.create();
    }

    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `${label.replace(/\s+/g, '_')}_${ts}.txt`;
    const file = new File(dir, filename);

    let content = `=== ${label} ===\n`;
    content += `Exported: ${now.toLocaleString('en-IN')}\n\n`;

    for (const msg of messages) {
      const roleLabel = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : msg.role;
      content += `[${roleLabel}]\n${msg.text}\n\n`;
    }

    await file.write(content);

    Alert.alert('Saved', `Chat saved to Documents/ai_chats/${filename}`);
    return file.uri;
  } catch (e: any) {
    Alert.alert('Error', `Failed to save: ${e?.message || 'Unknown error'}`);
    return null;
  }
}
