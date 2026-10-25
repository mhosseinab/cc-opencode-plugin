import { StringDecoder } from 'node:string_decoder';

/** Bounded UTF-8 JSONL decoder; tolerates informational non-JSON lines, not malformed JSON. */
export class EventDecoder {
  constructor(onEvent, onNotice) {
    this.decoder = new StringDecoder('utf8');
    this.pending = '';
    this.onEvent = onEvent;
    this.onNotice = onNotice;
  }
  push(chunk) {
    this.pending += this.decoder.write(chunk);
    this.drain();
    if (Buffer.byteLength(this.pending) > 1024 * 1024)
      throw new Error('OpenCode event exceeds 1 MiB.');
  }
  drain() {
    let index;
    while ((index = this.pending.indexOf('\n')) !== -1) {
      const line = this.pending.slice(0, index).trim();
      this.pending = this.pending.slice(index + 1);
      if (Buffer.byteLength(line) > 1024 * 1024) throw new Error('OpenCode event exceeds 1 MiB.');
      if (!line) continue;
      if (!line.startsWith('{')) {
        this.onNotice(line);
        continue;
      }
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        throw new Error('Malformed OpenCode JSON event.');
      }
      if (!event || typeof event.type !== 'string') throw new Error('Invalid OpenCode event.');
      this.onEvent(event);
    }
  }
  end() {
    this.pending += this.decoder.end();
    if (this.pending) this.pending += '\n';
    this.drain();
  }
}
