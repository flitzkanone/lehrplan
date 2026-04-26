import re

with open("app/lock.tsx", "r") as f:
    content = f.read()

# Remove import
content = re.sub(r"import \{ formatBackupDate \}.*?\n", "", content)

# Change useApp
content = re.sub(
    r"const \{ authenticateWithPin,.*?pinLength \} = useApp\(\);",
    "const { authenticateWithPin, pinLength } = useApp();",
    content
)

# Remove recovery state variables
content = re.sub(r"  const \[showRecoveryModal, setShowRecoveryModal\].*?\n", "", content)
content = re.sub(r"  const \[recoveryPin, setRecoveryPin\].*?\n", "", content)
content = re.sub(r"  const \[recoveryError, setRecoveryError\].*?\n", "", content)
content = re.sub(r"  const \[recoveryAttempts, setRecoveryAttempts\].*?\n", "", content)
content = re.sub(r"  const \[recoveryLockoutUntil, setRecoveryLockoutUntil\].*?\n", "", content)
content = re.sub(r"  const \[recoveryLockoutRemaining, setRecoveryLockoutRemaining\].*?\n", "", content)

# Remove recovery lockout effect
content = re.sub(r"  useEffect\(\(\) => \{\n    if \(recoveryLockoutUntil <= 0\).*?\}, \[recoveryLockoutUntil\]\);\n\n", "", content, flags=re.DOTALL)

# Remove recovery methods
content = re.sub(r"  const MAX_RECOVERY_ATTEMPTS = 5;.*?  };\n\n", "", content, flags=re.DOTALL)

# Remove recoveryBanner
content = re.sub(r"          \{recoveryAvailable && \(\n            <TouchableOpacity.*?          \)\}\n", "", content, flags=re.DOTALL)

# Remove Modal
content = re.sub(r"        <Modal visible=\{showRecoveryModal\}.*?</Modal>\n", "", content, flags=re.DOTALL)

with open("app/lock.tsx", "w") as f:
    f.write(content)

