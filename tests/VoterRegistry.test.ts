import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_VOTER_ID = 101;
const ERR_INVALID_ENCRYPTED_DATA = 102;
const ERR_INVALID_PROOF = 103;
const ERR_ALREADY_REGISTERED = 104;
const ERR_VOTER_NOT_FOUND = 105;
const ERR_INVALID_UPDATE = 106;
const ERR_INVALID_TIMESTAMP = 107;
const ERR_AUTHORITY_NOT_SET = 108;
const ERR_INVALID_STATUS = 109;
const ERR_MAX_VOTERS_EXCEEDED = 110;
const ERR_INVALID_LOCATION = 111;
const ERR_INVALID_AGE = 112;
const ERR_INVALID_CITIZENSHIP = 113;
const ERR_INVALID_REGISTRATION_FEE = 114;
const ERR_INVALID_VERIFICATION_THRESHOLD = 115;
const ERR_INVALID_GRACE_PERIOD = 116;
const ERR_INVALID_PENALTY = 117;
const ERR_INVALID_CURRENCY = 118;
const ERR_INVALID_ELIGIBILITY = 119;
const ERR_INVALID_AUDIT = 120;

interface Voter {
  voterId: Buffer;
  encryptedData: Buffer;
  registeredAt: number;
  status: boolean;
  location: string;
  age: number;
  citizenship: string;
  lastUpdate: number;
  penalty: number;
  currency: string;
}

interface VoterUpdate {
  updateEncryptedData: Buffer;
  updateTimestamp: number;
  updater: string;
  updateLocation: string;
  updateAge: number;
}

interface VoterAudit {
  auditTimestamp: number;
  auditor: string;
  auditStatus: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class VoterRegistryMock {
  state: {
    nextVoterId: number;
    maxVoters: number;
    registrationFee: number;
    authorityContract: string | null;
    verificationThreshold: number;
    gracePeriod: number;
    voters: Map<number, Voter>;
    voterUpdates: Map<number, VoterUpdate>;
    votersById: Map<string, number>;
    voterAudits: Map<number, VoterAudit>;
  } = {
    nextVoterId: 0,
    maxVoters: 1000000,
    registrationFee: 500,
    authorityContract: null,
    verificationThreshold: 50,
    gracePeriod: 30,
    voters: new Map(),
    voterUpdates: new Map(),
    votersById: new Map(),
    voterAudits: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextVoterId: 0,
      maxVoters: 1000000,
      registrationFee: 500,
      authorityContract: null,
      verificationThreshold: 50,
      gracePeriod: 30,
      voters: new Map(),
      voterUpdates: new Map(),
      votersById: new Map(),
      voterAudits: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  verifyProof(proof: Buffer): boolean {
    return proof.length > 0;
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === this.caller) {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxVoters(newMax: number): Result<boolean> {
    if (newMax <= 0) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.maxVoters = newMax;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (newFee < 0) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  setVerificationThreshold(newThreshold: number): Result<boolean> {
    if (newThreshold <= 0 || newThreshold > 100) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.verificationThreshold = newThreshold;
    return { ok: true, value: true };
  }

  setGracePeriod(newPeriod: number): Result<boolean> {
    if (newPeriod > 90) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.gracePeriod = newPeriod;
    return { ok: true, value: true };
  }

  registerVoter(
    voterId: Buffer,
    encryptedData: Buffer,
    zkProof: Buffer,
    location: string,
    age: number,
    citizenship: string,
    penalty: number,
    currency: string
  ): Result<number> {
    if (this.state.nextVoterId >= this.state.maxVoters) return { ok: false, value: ERR_MAX_VOTERS_EXCEEDED };
    if (voterId.length === 0 || voterId.length > 32) return { ok: false, value: ERR_INVALID_VOTER_ID };
    if (encryptedData.length === 0 || encryptedData.length > 256) return { ok: false, value: ERR_INVALID_ENCRYPTED_DATA };
    if (zkProof.length === 0) return { ok: false, value: ERR_INVALID_PROOF };
    if (location.length === 0 || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (age < 18) return { ok: false, value: ERR_INVALID_AGE };
    if (citizenship.length === 0 || citizenship.length > 50) return { ok: false, value: ERR_INVALID_CITIZENSHIP };
    if (penalty > 100) return { ok: false, value: ERR_INVALID_PENALTY };
    if (!["STX", "USD"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (!this.verifyProof(zkProof)) return { ok: false, value: ERR_INVALID_ELIGIBILITY };
    if (this.state.votersById.has(voterId.toString("hex"))) return { ok: false, value: ERR_ALREADY_REGISTERED };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextVoterId;
    const voter: Voter = {
      voterId,
      encryptedData,
      registeredAt: this.blockHeight,
      status: true,
      location,
      age,
      citizenship,
      lastUpdate: this.blockHeight,
      penalty,
      currency,
    };
    this.state.voters.set(id, voter);
    this.state.votersById.set(voterId.toString("hex"), id);
    this.state.nextVoterId++;
    return { ok: true, value: id };
  }

  getVoter(id: number): Voter | null {
    return this.state.voters.get(id) || null;
  }

  updateVoter(id: number, updateEncryptedData: Buffer, updateLocation: string, updateAge: number): Result<boolean> {
    const voter = this.state.voters.get(id);
    if (!voter) return { ok: false, value: false };
    if (updateEncryptedData.length === 0 || updateEncryptedData.length > 256) return { ok: false, value: false };
    if (updateLocation.length === 0 || updateLocation.length > 100) return { ok: false, value: false };
    if (updateAge < 18) return { ok: false, value: false };

    const updated: Voter = {
      ...voter,
      encryptedData: updateEncryptedData,
      location: updateLocation,
      age: updateAge,
      lastUpdate: this.blockHeight,
    };
    this.state.voters.set(id, updated);
    this.state.voterUpdates.set(id, {
      updateEncryptedData,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateLocation,
      updateAge,
    });
    return { ok: true, value: true };
  }

  auditVoter(id: number, auditStatus: boolean): Result<boolean> {
    const voter = this.state.voters.get(id);
    if (!voter) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };

    this.state.voterAudits.set(id, {
      auditTimestamp: this.blockHeight,
      auditor: this.caller,
      auditStatus,
    });
    return { ok: true, value: true };
  }

  getVoterCount(): Result<number> {
    return { ok: true, value: this.state.nextVoterId };
  }

  checkVoterExistence(voterId: Buffer): Result<boolean> {
    return { ok: true, value: this.state.votersById.has(voterId.toString("hex")) };
  }

  getVoterAudit(id: number): VoterAudit | null {
    return this.state.voterAudits.get(id) || null;
  }
}

describe("VoterRegistry", () => {
  let contract: VoterRegistryMock;

  beforeEach(() => {
    contract = new VoterRegistryMock();
    contract.reset();
  });

  it("registers a voter successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    const result = contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const voter = contract.getVoter(0);
    expect(voter?.voterId.toString("hex")).toBe(voterId.toString("hex"));
    expect(voter?.encryptedData.toString("hex")).toBe(encryptedData.toString("hex"));
    expect(voter?.location).toBe("LocationX");
    expect(voter?.age).toBe(25);
    expect(voter?.citizenship).toBe("CitizenY");
    expect(voter?.penalty).toBe(5);
    expect(voter?.currency).toBe("STX");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate voter ids", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    const result = contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationZ",
      30,
      "CitizenW",
      10,
      "USD"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_REGISTERED);
  });

  it("rejects registration without authority contract", () => {
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    const result = contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_SET);
  });

  it("rejects invalid voter id", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId = Buffer.from("".padEnd(0, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    const result = contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_VOTER_ID);
  });

  it("rejects invalid age", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    const result = contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      17,
      "CitizenY",
      5,
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AGE);
  });

  it("rejects invalid currency", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    const result = contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "BTC"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CURRENCY);
  });

  it("updates a voter successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    const updateEncryptedData = Buffer.from("newencrypted".padEnd(256, " "));
    const result = contract.updateVoter(0, updateEncryptedData, "NewLocation", 30);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const voter = contract.getVoter(0);
    expect(voter?.encryptedData.toString("hex")).toBe(updateEncryptedData.toString("hex"));
    expect(voter?.location).toBe("NewLocation");
    expect(voter?.age).toBe(30);
    const update = contract.state.voterUpdates.get(0);
    expect(update?.updateEncryptedData.toString("hex")).toBe(updateEncryptedData.toString("hex"));
    expect(update?.updateLocation).toBe("NewLocation");
    expect(update?.updateAge).toBe(30);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent voter", () => {
    contract.setAuthorityContract("ST2TEST");
    const updateEncryptedData = Buffer.from("newencrypted".padEnd(256, " "));
    const result = contract.updateVoter(99, updateEncryptedData, "NewLocation", 30);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("audits a voter successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    const result = contract.auditVoter(0, true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const audit = contract.getVoterAudit(0);
    expect(audit?.auditStatus).toBe(true);
    expect(audit?.auditor).toBe("ST1TEST");
  });

  it("rejects audit without authority contract", () => {
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    const result = contract.auditVoter(0, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects registration fee change without authority contract", () => {
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct voter count", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId1 = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData1 = Buffer.from("encrypted1".padEnd(256, " "));
    const zkProof1 = Buffer.from("proof1");
    contract.registerVoter(
      voterId1,
      encryptedData1,
      zkProof1,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    const voterId2 = Buffer.from("voter2".padEnd(32, " "));
    const encryptedData2 = Buffer.from("encrypted2".padEnd(256, " "));
    const zkProof2 = Buffer.from("proof2");
    contract.registerVoter(
      voterId2,
      encryptedData2,
      zkProof2,
      "LocationZ",
      30,
      "CitizenW",
      10,
      "USD"
    );
    const result = contract.getVoterCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks voter existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const voterId = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData = Buffer.from("encrypted".padEnd(256, " "));
    const zkProof = Buffer.from("proof");
    contract.registerVoter(
      voterId,
      encryptedData,
      zkProof,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    const result = contract.checkVoterExistence(voterId);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const nonExistentId = Buffer.from("nonexistent".padEnd(32, " "));
    const result2 = contract.checkVoterExistence(nonExistentId);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects voter registration with max voters exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxVoters = 1;
    const voterId1 = Buffer.from("voter1".padEnd(32, " "));
    const encryptedData1 = Buffer.from("encrypted1".padEnd(256, " "));
    const zkProof1 = Buffer.from("proof1");
    contract.registerVoter(
      voterId1,
      encryptedData1,
      zkProof1,
      "LocationX",
      25,
      "CitizenY",
      5,
      "STX"
    );
    const voterId2 = Buffer.from("voter2".padEnd(32, " "));
    const encryptedData2 = Buffer.from("encrypted2".padEnd(256, " "));
    const zkProof2 = Buffer.from("proof2");
    const result = contract.registerVoter(
      voterId2,
      encryptedData2,
      zkProof2,
      "LocationZ",
      30,
      "CitizenW",
      10,
      "USD"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_VOTERS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});