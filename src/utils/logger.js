function serializeMeta(meta) {
  if (!meta) return '';
  try {
    if (typeof meta === 'string') return meta;
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

function log(level, message, meta) {
  const ts = new Date().toISOString();
  const pid = process.pid;
  const metaStr = serializeMeta(meta);
  const line = metaStr ? `${ts} [${pid}] ${level} ${message} ${metaStr}` : `${ts} [${pid}] ${level} ${message}`;

  if (level === 'ERROR') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'WARN') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

module.exports = {
  info: (message, meta) => log('INFO', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  error: (message, meta) => log('ERROR', message, meta)
};
