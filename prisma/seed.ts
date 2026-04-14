import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const church = await prisma.church.upsert({
    where: { slug: "demo-church" },
    update: {},
    create: {
      id: "demo-church",
      name: "Grace Fellowship Church",
      slug: "demo-church",
      timezone: "America/Chicago",
    },
  });

  await prisma.member.createMany({
    data: [
      {
        churchId: church.id,
        firstName: "Angela",
        lastName: "Brooks",
        preferredName: "Angela",
        phoneMobile: "5552031188",
        email: "angela@example.com",
      },
      {
        churchId: church.id,
        firstName: "David",
        lastName: "Carter",
        preferredName: "David",
        phoneMobile: "5551049920",
        email: "david@example.com",
      },
    ],
    skipDuplicates: true,
  });

  await prisma.group.createMany({
    data: [
      {
        churchId: church.id,
        name: "Faith Builders Class",
        groupType: "SUNDAY_SCHOOL",
        visibility: "PRIVATE",
        description: "A Sunday school class with weekly conversation, prayer requests, and sermon follow-up.",
      },
      {
        churchId: church.id,
        name: "Worship Team",
        groupType: "MINISTRY",
        visibility: "PRIVATE",
        description: "Song planning, rehearsal reminders, and worship ministry communication.",
      },
    ],
    skipDuplicates: true,
  });

  await prisma.calendar.createMany({
    data: [
      {
        churchId: church.id,
        name: "Main Staff Calendar",
        visibility: "INTERNAL",
      },
      {
        churchId: church.id,
        name: "Church Public Calendar",
        visibility: "PUBLIC",
      },
    ],
    skipDuplicates: true,
  });

  const [angela, david, faithBuilders, worshipTeam] = await Promise.all([
    prisma.member.findFirstOrThrow({ where: { churchId: church.id, email: "angela@example.com" } }),
    prisma.member.findFirstOrThrow({ where: { churchId: church.id, email: "david@example.com" } }),
    prisma.group.findFirstOrThrow({ where: { churchId: church.id, name: "Faith Builders Class" } }),
    prisma.group.findFirstOrThrow({ where: { churchId: church.id, name: "Worship Team" } }),
  ]);

  await prisma.groupMember.upsert({
    where: { groupId_memberId: { groupId: faithBuilders.id, memberId: angela.id } },
    update: { role: "LEADER" },
    create: { groupId: faithBuilders.id, memberId: angela.id, role: "LEADER" },
  });

  await prisma.groupMember.upsert({
    where: { groupId_memberId: { groupId: faithBuilders.id, memberId: david.id } },
    update: { role: "MEMBER" },
    create: { groupId: faithBuilders.id, memberId: david.id, role: "MEMBER" },
  });

  await prisma.groupMember.upsert({
    where: { groupId_memberId: { groupId: worshipTeam.id, memberId: david.id } },
    update: { role: "LEADER" },
    create: { groupId: worshipTeam.id, memberId: david.id, role: "LEADER" },
  });

  const welcomePost = await prisma.groupPost.upsert({
    where: { id: `${faithBuilders.id}-welcome-post` },
    update: {},
    create: {
      id: `${faithBuilders.id}-welcome-post`,
      churchId: church.id,
      groupId: faithBuilders.id,
      authorMemberId: angela.id,
      postType: "ANNOUNCEMENT",
      title: "Welcome to Faith Builders",
      body: "Use this space for prayer requests, weekly class reminders, sermon takeaways, and encouragement throughout the week.",
      isPinned: true,
    },
  });

  await prisma.groupPost.upsert({
    where: { id: `${faithBuilders.id}-sermon-post` },
    update: {},
    create: {
      id: `${faithBuilders.id}-sermon-post`,
      churchId: church.id,
      groupId: faithBuilders.id,
      authorMemberId: david.id,
      postType: "TEXT",
      title: "Sunday sermon takeaway",
      body: "This week's sermon reminded me that faithful service grows in daily habits. What stood out to everyone else?",
    },
  });

  await prisma.groupComment.upsert({
    where: { id: `${welcomePost.id}-comment-1` },
    update: {},
    create: {
      id: `${welcomePost.id}-comment-1`,
      postId: welcomePost.id,
      authorMemberId: david.id,
      body: "Love this. I can already see this helping our class stay connected through the week.",
    },
  });

  await prisma.groupReaction.upsert({
    where: {
      postId_memberId_reactionType: {
        postId: welcomePost.id,
        memberId: david.id,
        reactionType: "AMEN",
      },
    },
    update: {},
    create: {
      postId: welcomePost.id,
      memberId: david.id,
      reactionType: "AMEN",
    },
  });

  await prisma.groupReaction.upsert({
    where: {
      postId_memberId_reactionType: {
        postId: welcomePost.id,
        memberId: angela.id,
        reactionType: "LOVE",
      },
    },
    update: {},
    create: {
      postId: welcomePost.id,
      memberId: angela.id,
      reactionType: "LOVE",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });