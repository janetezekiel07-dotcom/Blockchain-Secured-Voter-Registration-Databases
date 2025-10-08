# Blockchain-Secured Voter Registration Databases

This Web3 project uses the Stacks blockchain and Clarity smart contracts to create a secure, transparent, and tamper-proof voter registration database. It addresses issues like voter fraud, duplicate registrations, and lack of trust in centralized systems by decentralizing voter data management.

## ✨ Features

- **Secure Voter Registration**: Register voters with encrypted personal data and unique IDs.  
- **Identity Verification**: Verify eligibility without exposing sensitive data using zero-knowledge proofs.  
- **Immutable Audit Trail**: Record all actions on the blockchain for transparency.  
- **Privacy Protection**: Ensure voter data remains confidential.  
- **Decentralized Access Control**: Securely manage access for election officials.  
- **Update Mechanism**: Allow voters to update details like address changes.  
- **Transparency**: Provide public access to anonymized registration stats.  
- **Fraud Prevention**: Prevent duplicate or invalid registrations.

## 🛠 How It Works

**For Voters**  
- Generate a unique voter ID (hash of name, DOB, and government ID).  
- Call `register-voter` with encrypted data and a zero-knowledge proof of eligibility.  
- Update details (e.g., address) using `update-voter`.  

**For Election Officials**  
- Use `verify-voter` to confirm eligibility without accessing private data.  
- Access anonymized stats via `get-stats`.  

**For Auditors**  
- Query `audit-trail` to review all actions.  
- Use `check-duplicates` to ensure database integrity.

