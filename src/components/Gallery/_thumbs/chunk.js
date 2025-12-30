function chunkItems(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

function buildChunkMap(items, size, labelPrefix) {
    const chunks = chunkItems(items, size);

    const map = {};
    chunks.forEach((chunk, i) => {
        const start = i * size + 1;
        const end = i * size + chunk.length;
        const label = `${labelPrefix}, ${i + 1} (${start}-${end})`;
        map[label] = chunk;
    });

    return map;
}

export { chunkItems, buildChunkMap };