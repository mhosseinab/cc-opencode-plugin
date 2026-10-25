const RUN_FIELDS = ['prompt', 'agent', 'model', 'variant', 'resume', 'timeoutSeconds', 'base'];
const COMMON_FIELDS = ['cwd'];
export const RUN_COMMANDS = ['task', 'review', 'adversarial-review', 'transfer'];
export const COMMANDS = [
  ...RUN_COMMANDS,
  'status',
  'result',
  'cancel',
  'setup',
  'agents',
  'models',
];

/** Validate the entire request before invoking any tools or writing state. */
export function validate(command, input) {
  if (!COMMANDS.includes(command)) throw new Error(`Unknown command: ${command}`);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Request must be a JSON object.');
  }
  const run = RUN_COMMANDS.includes(command);
  const fields = [...COMMON_FIELDS, ...(run ? RUN_FIELDS : ['job'])];
  for (const [key, value] of Object.entries(input)) {
    if (!fields.includes(key)) throw new Error(`Unknown field: ${key}`);
    if (key === 'timeoutSeconds') {
      if (!Number.isInteger(value) || value < 1 || value > 86400) {
        throw new Error('timeoutSeconds must be an integer from 1 to 86400.');
      }
    } else if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
      throw new Error(`${key} must be a nonempty string without NUL bytes.`);
    }
  }
  if (['task', 'transfer'].includes(command) && !input.prompt) {
    throw new Error('A prompt is required.');
  }
  if (input.model && !/^[^/\s]+\/\S+$/.test(input.model)) {
    throw new Error('model must use provider/model format.');
  }
  for (const key of ['job', 'resume']) {
    if (input[key] && !/^[a-f0-9]{32}$/.test(input[key])) {
      throw new Error(`${key} must be a complete 32-character job ID.`);
    }
  }
  const review = command.includes('review');
  if (review && (input.agent || input.resume)) {
    throw new Error('Reviews use a fresh restricted agent; agent and resume are not supported.');
  }
  if (!review && input.base) throw new Error('base is only supported for reviews.');
  if (input.base?.startsWith('-')) throw new Error('base must not start with a dash.');
  if (['cancel', 'result'].includes(command) && !input.job) {
    throw new Error(`${command} requires an explicit job ID.`);
  }
  if (['setup', 'agents', 'models'].includes(command) && input.job) {
    throw new Error(`${command} does not accept job.`);
  }
  return { ...input, timeoutSeconds: run ? (input.timeoutSeconds ?? 1800) : undefined };
}

export async function readInput(stream, limit = 262144) {
  let size = 0;
  const chunks = [];
  for await (const chunk of stream) {
    size += Buffer.byteLength(chunk);
    if (size > limit) throw new Error(`JSON request exceeds ${limit} bytes.`);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
  return text.trim() ? JSON.parse(text) : {};
}
