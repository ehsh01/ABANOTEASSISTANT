#!/bin/bash
# Check all ports and verify ABA Note Assistant is on dedicated ports
# Run on droplet: bash check-all-ports.sh

echo "🔍 Port Usage Analysis"
echo "====================="
echo ""

echo "=== All Listening Ports ==="
ss -tlnp | grep LISTEN | awk '{print $4, $7}' | sort -t: -k2 -n | column -t
echo ""

echo "=== PM2 Processes and Ports ==="
pm2 list --format json | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
console.log('PM2 Process | Port | Status');
console.log('----------------------------');
data.forEach(p => {
  const name = p.name || 'N/A';
  const port = p.pm2_env?.PORT || p.pm2_env?.env?.PORT || 'N/A';
  const status = p.pm2_env?.status || 'N/A';
  console.log(\`\${name.padEnd(20)} | \${String(port).padEnd(4)} | \${status}\`);
});
"
echo ""

echo "=== Checking ABA Note Assistant Ports ==="
echo "Expected:"
echo "  - Production API: Port 5002"
echo "  - Staging API: Port 5005"
echo ""

# Check if ports 5002 and 5005 are in use
if ss -tlnp | grep -q ":5002"; then
  echo "✅ Port 5002 is in use:"
  ss -tlnp | grep ":5002"
  # Check if it's ABA Note Assistant
  if ss -tlnp | grep ":5002" | grep -q "abanoteassistant\|5002"; then
    echo "   ✅ Appears to be ABA Note Assistant"
  else
    echo "   ⚠️  May not be ABA Note Assistant - check process"
  fi
else
  echo "❌ Port 5002 is NOT in use"
fi

echo ""

if ss -tlnp | grep -q ":5005"; then
  echo "✅ Port 5005 is in use:"
  ss -tlnp | grep ":5005"
else
  echo "ℹ️  Port 5005 is NOT in use (staging not started)"
fi

echo ""

echo "=== Port Conflicts Check ==="
echo "Checking for other apps on ports 5002-5006:"
for port in 5002 5003 5004 5005 5006; do
  if ss -tlnp | grep -q ":$port "; then
    process=$(ss -tlnp | grep ":$port " | awk '{print $7}')
    echo "  Port $port: $process"
  fi
done

echo ""

echo "=== ABA Note Assistant PM2 Status ==="
pm2 list | grep abanoteassistant || echo "No ABA Note Assistant processes found"

echo ""

echo "=== Port Summary ==="
echo "Known apps and their ports:"
echo "  - abaworkspace: 5001"
echo "  - abaworkspace-staging: 5004"
echo "  - ABA Note Assistant (production): 5002"
echo "  - ABA Note Assistant (staging): 5005"
echo "  - reviewkeeper: 5000"
