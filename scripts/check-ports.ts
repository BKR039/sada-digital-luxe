async function checkServers() {
  for (const port of [3000, 3001, 5173]) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      console.log(`Port ${port}: status ${res.status}`);
    } catch {
      console.log(`Port ${port}: not responding`);
    }
  }
}
checkServers();
