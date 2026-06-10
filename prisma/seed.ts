import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Demo workspace with a realistic prospect map so the app is explorable
// immediately after `npm run db:seed`.
async function main() {
  const existing = await db.user.findFirst();
  if (existing) {
    console.log("Seed data already present — skipping.");
    return;
  }

  const user = await db.user.create({
    data: { email: "demo@example.com", name: "Demo Rep" },
  });
  const workspace = await db.workspace.create({ data: { name: "Demo Sales Team" } });
  await db.membership.create({
    data: { userId: user.id, workspaceId: workspace.id, role: "owner" },
  });

  const map = await db.orgMap.create({
    data: {
      name: "Acme Corp — Platform Deal",
      description: "Mapping the buying committee for the Q3 platform expansion.",
      workspaceId: workspace.id,
    },
  });

  const acme = await db.company.create({
    data: { orgMapId: map.id, name: "Acme Corp", domain: "acme.example", industry: "Manufacturing" },
  });
  const acmeDigital = await db.company.create({
    data: { orgMapId: map.id, name: "Acme Digital (division)", parentId: acme.id },
  });

  async function person(
    firstName: string,
    lastName: string,
    title: string,
    disposition: string,
    companyId: string,
    seniority: string,
    email?: string
  ) {
    const p = await db.person.create({
      data: { orgMapId: map.id, firstName, lastName, disposition, email },
    });
    await db.position.create({ data: { personId: p.id, companyId, title, seniority } });
    return p;
  }

  const ceo = await person("Dana", "Whitfield", "CEO", "unknown", acme.id, "c_level");
  const cto = await person("Marcus", "Lee", "CTO", "economic_buyer", acme.id, "c_level", "marcus.lee@acme.example");
  const cfo = await person("Priya", "Raman", "CFO", "blocker", acme.id, "c_level");
  const vpEng = await person("Sofia", "Alvarez", "VP Engineering", "champion", acme.id, "vp", "sofia.alvarez@acme.example");
  const dirPlat = await person("James", "Okafor", "Director, Platform", "influencer", acmeDigital.id, "director");
  const dirSec = await person("Hannah", "Cho", "Director, Security", "technical_buyer", acme.id, "director");

  const reports: [string, string][] = [
    [cto.id, ceo.id],
    [cfo.id, ceo.id],
    [vpEng.id, cto.id],
    [dirPlat.id, vpEng.id],
    [dirSec.id, cto.id],
  ];
  for (const [fromId, toId] of reports) {
    await db.edge.create({
      data: { orgMapId: map.id, fromId, toId, type: "REPORTS_TO" },
    });
  }
  await db.edge.create({
    data: {
      orgMapId: map.id,
      fromId: vpEng.id,
      toId: cfo.id,
      type: "INFLUENCES",
      strength: 4,
      notes: "Sofia presents the infra budget case to Priya quarterly.",
    },
  });
  await db.edge.create({
    data: {
      orgMapId: map.id,
      fromId: dirPlat.id,
      toId: vpEng.id,
      type: "ALLY_OF",
      strength: 5,
      notes: "Worked together at previous company.",
    },
  });

  const callSource = await db.source.create({
    data: { kind: "call_note", title: "Discovery call 2026-06-02", detail: "45 min with Sofia + James" },
  });
  const linkedinSource = await db.source.create({
    data: {
      kind: "linkedin",
      title: "LinkedIn profile",
      url: "https://www.linkedin.com/in/example",
    },
  });

  await db.fact.create({
    data: {
      label: "Budget authority",
      value: "Owns the $2M platform infrastructure budget for FY26.",
      confidence: "verified",
      personId: cto.id,
      sourceId: callSource.id,
      createdBy: user.id,
    },
  });
  await db.fact.create({
    data: {
      label: "Pain point",
      value: "Current vendor's outages cost ~3 eng-days/month; renewal is in October.",
      confidence: "verified",
      personId: vpEng.id,
      sourceId: callSource.id,
      createdBy: user.id,
    },
  });
  await db.fact.create({
    data: {
      label: "Background",
      value: "Previously led platform migration at Globex — familiar with our category.",
      confidence: "likely",
      personId: dirPlat.id,
      sourceId: linkedinSource.id,
      createdBy: user.id,
    },
  });
  await db.fact.create({
    data: {
      label: "Procurement posture",
      value: "Pushing a company-wide spend freeze through Q3; needs ROI case.",
      confidence: "unverified",
      personId: cfo.id,
      createdBy: user.id,
    },
  });

  await db.artifact.create({
    data: {
      kind: "note",
      title: "Discovery call summary",
      body: "Sofia is our champion. Decision committee: Marcus (econ buyer), Hannah (security review), Priya (sign-off above $500k). Timeline driven by October renewal.",
      personId: vpEng.id,
      createdBy: user.id,
    },
  });
  await db.artifact.create({
    data: {
      kind: "link",
      title: "Acme FY25 annual report",
      url: "https://example.com/acme-annual-report.pdf",
      companyId: acme.id,
      createdBy: user.id,
    },
  });

  await db.activity.create({
    data: {
      orgMapId: map.id,
      userId: user.id,
      verb: "created",
      entity: "map",
      entityId: map.id,
      summary: 'Created org map "Acme Corp — Platform Deal"',
    },
  });

  // Second target org so the multi-org network view has bridges to show.
  const map2 = await db.orgMap.create({
    data: {
      name: "Globex Industries — Renewal",
      description: "Existing customer, renewal + upsell in Q4.",
      workspaceId: workspace.id,
    },
  });
  const globex = await db.company.create({
    data: { orgMapId: map2.id, name: "Globex Industries", domain: "globex.example", industry: "Logistics" },
  });
  const elena = await db.person.create({
    data: {
      orgMapId: map2.id,
      firstName: "Elena",
      lastName: "Petrova",
      disposition: "champion",
      email: "elena.petrova@globex.example",
    },
  });
  await db.position.create({
    data: { personId: elena.id, companyId: globex.id, title: "VP Operations", seniority: "vp" },
  });

  // Work-history bridge: James (Acme) previously worked at Globex.
  await db.position.create({
    data: {
      personId: dirPlat.id,
      companyId: globex.id,
      title: "Platform Lead",
      current: false,
      startDate: new Date("2019-03-01"),
      endDate: new Date("2023-08-01"),
    },
  });
  // Cross-org relationship bridge.
  await db.edge.create({
    data: {
      orgMapId: map.id,
      fromId: dirPlat.id,
      toId: elena.id,
      type: "FORMER_COLLEAGUE",
      strength: 4,
      notes: "Worked together at Globex 2019–2023.",
    },
  });

  // Demo LinkedIn import: Sofia is the rep's 1st-degree connection; Tom is a
  // contact at Globex who isn't mapped yet (still shows a path into the org).
  await db.linkedInContact.create({
    data: {
      userId: user.id,
      firstName: "Sofia",
      lastName: "Alvarez",
      profileUrl: "https://www.linkedin.com/in/sofia-alvarez-demo",
      company: "Acme Corp",
      position: "VP Engineering",
      connectedOn: new Date("2024-11-05"),
      personId: vpEng.id,
    },
  });
  await db.linkedInContact.create({
    data: {
      userId: user.id,
      firstName: "Tom",
      lastName: "Becker",
      profileUrl: "https://www.linkedin.com/in/tom-becker-demo",
      company: "Globex Industries",
      position: "Director of IT",
      connectedOn: new Date("2023-02-14"),
    },
  });

  console.log("Seeded demo workspace, user (demo@example.com), Acme + Globex maps.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
