import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedReactionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/layout/badge";
import { SectionCard } from "@/components/layout/section-card";
import {
  addGroupMemberAction,
  createGroupCommentAction,
  createGroupPostAction,
  removeGroupMemberAction,
  toggleGroupReactionAction,
} from "./actions";

const reactionLabels: FeedReactionType[] = ["LIKE", "AMEN", "PRAY", "LOVE"];

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const auth = await requireAuthContext();
  const { groupId } = await params;

  const group = await prisma.group.findFirst({
    where: { id: groupId, churchId: auth.churchId },
    include: {
      memberships: {
        include: { member: true },
        orderBy: { joinedAt: "asc" },
      },
      posts: {
        include: {
          author: true,
          comments: {
            include: { author: true },
            orderBy: { createdAt: "asc" },
          },
          reactions: true,
          media: true,
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 24,
      },
      events: {
        where: { startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 5,
      },
    },
  });

  if (!group) {
    notFound();
  }

  const availableMembers = await prisma.member.findMany({
    where: {
      churchId: auth.churchId,
      groupLinks: {
        none: {
          groupId: group.id,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 100,
  });

  const fallbackMember = group.memberships[0]?.member ?? (await prisma.member.findFirst({
    where: { churchId: auth.churchId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  }));

  const pinnedPosts = group.posts.filter((post) => post.isPinned);
  const feedPosts = group.posts.filter((post) => !post.isPinned);
  const visiblePosts = pinnedPosts.length ? [...pinnedPosts, ...feedPosts] : group.posts;
  const commentCount = visiblePosts.reduce((total, post) => total + post.comments.length, 0);

  return (
    <AppShell
      title={group.name}
      subtitle={group.description || "This internal group feed keeps announcements, prayer requests, sermon notes, and day-to-day conversation together."}
      currentPath="/groups"
      actions={<Link href="/groups" className="button secondary">Back to groups</Link>}
    >
      <section className="hero-card group-hero">
        <div className="stack">
          <div className="toolbar toolbar-start">
            <Badge>{group.groupType.replaceAll("_", " ")}</Badge>
            <Badge>{group.visibility === "PRIVATE" ? "Private community" : "Church-visible feed"}</Badge>
          </div>
          <h3 className="card-title hero-heading">A private church social space for this group.</h3>
          <p className="page-subtitle">
            Members can share updates, sermon notes, care needs, prayer requests, photos, and videos here, while leaders pin announcements and keep the conversation organized.
          </p>
          <div className="stat-strip">
            <div className="stat-tile">
              <strong>{group.memberships.length}</strong>
              <span>Members</span>
            </div>
            <div className="stat-tile">
              <strong>{group.posts.length}</strong>
              <span>Posts</span>
            </div>
            <div className="stat-tile">
              <strong>{group.events.length}</strong>
              <span>Upcoming events</span>
            </div>
          </div>
        </div>

        <div className="panel panel-soft stack">
          <h3 className="card-title">What leaders can do here</h3>
          <div className="list compact-list">
            <div className="list-item"><span>Post sermon info only to the people who need it, like youth, kids, worship, or a staff team.</span></div>
            <div className="list-item"><span>Keep prayer threads, reminders, and bulk communication tied to this exact audience.</span></div>
            <div className="list-item"><span>Build a community page that feels alive and familiar, not just a dry database record.</span></div>
          </div>
        </div>
      </section>

      {pinnedPosts.length ? (
        <SectionCard title="Pinned highlights" action={<Badge>{pinnedPosts.length} pinned</Badge>}>
          <div className="three-column social-highlight-grid">
            {pinnedPosts.map((post) => (
              <article key={post.id} className="panel panel-soft stack highlight-card">
                <div className="toolbar toolbar-start">
                  <Badge>Pinned</Badge>
                  <span className="muted">{formatDateTime(post.createdAt)}</span>
                </div>
                <strong>{post.title || "Group highlight"}</strong>
                <p className="muted">{post.body || "Open the post below to view the full update."}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <section className="feed-layout">
        <div className="feed-main stack">
          <SectionCard title="Create post" action={fallbackMember ? <Badge>{fallbackMember.firstName} posting</Badge> : undefined}>
            {fallbackMember ? (
              <form action={createGroupPostAction} className="form-grid social-composer" encType="multipart/form-data">
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="authorMemberId" value={fallbackMember.id} />
                <div className="two-up-inputs">
                  <select className="select" name="postType" defaultValue="TEXT">
                    <option value="TEXT">Conversation post</option>
                    <option value="ANNOUNCEMENT">Announcement</option>
                    <option value="PRAYER_REQUEST">Prayer request</option>
                    <option value="PHOTO">Photo update</option>
                    <option value="VIDEO">Video update</option>
                  </select>
                  <input className="input" name="title" placeholder="Optional post title" />
                </div>
                <textarea className="textarea" name="body" rows={5} placeholder="Share a sermon note, group update, encouragement, reminder, prayer request, or ministry conversation..." required />
                <div className="composer-footer"><label className="media-upload-field"><span className="media-upload-label">Add photo or video</span><input className="input" name="mediaFile" type="file" accept="image/*,video/*" /></label><div className="composer-actions"><span className="muted">Upload one image or video per post for now.</span><button className="button" type="submit">Publish to group feed</button></div></div>
              </form>
            ) : (
              <p className="muted">Add at least one member to the church directory so this group can start posting.</p>
            )}
          </SectionCard>

          <div className="section-tabs">
            <span className="section-tab active">Feed</span>
            <span className="section-tab">Media</span>
            <span className="section-tab">Prayer</span>
            <span className="section-tab">Announcements</span>
          </div>

          <div className="stack">
            {visiblePosts.length ? (
              visiblePosts.map((post) => {
                const reactionSummary = reactionLabels
                  .map((type) => ({ type, count: post.reactions.filter((reaction) => reaction.reactionType === type).length }))
                  .filter((entry) => entry.count > 0);

                return (
                  <article key={post.id} className="post-card social-post-card">
                    <div className="post-header">
                      <div className="post-author">
                        <div className="avatar">{post.author.firstName.slice(0, 1)}{post.author.lastName.slice(0, 1)}</div>
                        <div>
                          <strong>{post.author.firstName} {post.author.lastName}</strong>
                          <div className="muted">{formatDateTime(post.createdAt)} - {post.postType.replaceAll("_", " ")}</div>
                        </div>
                      </div>
                      <div className="toolbar toolbar-start">
                        {post.isPinned ? <Badge>Pinned</Badge> : null}
                        {post.isLocked ? <Badge tone="warn">Locked</Badge> : null}
                      </div>
                    </div>

                    {post.title ? <h3 className="card-title feed-title">{post.title}</h3> : null}
                    {post.body ? <p className="post-body">{post.body}</p> : null}

                    {post.media.length ? (
                      <div className="media-grid">
                        {post.media.map((media) => {
                          const isImage = media.mediaType.startsWith("image/");
                          const isVideo = media.mediaType.startsWith("video/");

                          return (
                            <div key={media.id} className="media-card rich-media-card">
                              {isImage ? <img className="feed-media" src={media.url} alt={post.title || "Group upload"} /> : null}
                              {isVideo ? <video className="feed-media" controls src={media.url} /> : null}
                              {!isImage && !isVideo ? <p className="muted">{media.url}</p> : null}
                              <div className="media-meta">
                                <strong>{isImage ? "Photo" : isVideo ? "Video" : media.mediaType}</strong>
                                <span className="muted">Uploaded to the group feed</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    <div className="reaction-row">
                      {reactionSummary.length ? reactionSummary.map((entry) => (
                        <span key={entry.type} className="reaction-pill">{entry.type.toLowerCase()} - {entry.count}</span>
                      )) : <span className="muted">No reactions yet</span>}
                      <span className="muted">{post.comments.length} comments</span>
                    </div>

                    {fallbackMember ? (
                      <div className="reaction-action-row">
                        {reactionLabels.map((reactionType) => (
                          <form key={reactionType} action={toggleGroupReactionAction}>
                            <input type="hidden" name="groupId" value={group.id} />
                            <input type="hidden" name="postId" value={post.id} />
                            <input type="hidden" name="memberId" value={fallbackMember.id} />
                            <input type="hidden" name="reactionType" value={reactionType} />
                            <button className="reaction-button" type="submit">{reactionType.toLowerCase()}</button>
                          </form>
                        ))}
                      </div>
                    ) : null}

                    <div className="comment-stack">
                      {post.comments.length ? (
                        post.comments.slice(0, 4).map((comment) => (
                          <div key={comment.id} className="comment-card">
                            <strong>{comment.author.firstName} {comment.author.lastName}</strong>
                            <div className="muted">{formatDateTime(comment.createdAt)}</div>
                            <p>{comment.body}</p>
                          </div>
                        ))
                      ) : (
                        <p className="muted">No comments yet. Be the first to respond.</p>
                      )}
                    </div>

                    {fallbackMember ? (
                      <form action={createGroupCommentAction} className="comment-form">
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="authorMemberId" value={fallbackMember.id} />
                        <input className="input" name="body" placeholder="Write a comment to keep the conversation moving..." required />
                        <button className="button secondary" type="submit">Comment</button>
                      </form>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <SectionCard title="Group feed is ready">
                <p className="muted">This group does not have posts yet. Start with a welcome message, this week's sermon notes, or a ministry reminder so the community page begins to feel alive.</p>
              </SectionCard>
            )}
          </div>
        </div>

        <div className="feed-side stack">
          <SectionCard title="Community pulse">
            <div className="stack">
              <div className="panel panel-soft">
                <strong>{pinnedPosts.length}</strong>
                <p className="muted">pinned highlights keeping the group focused</p>
              </div>
              <div className="panel panel-soft">
                <strong>{commentCount}</strong>
                <p className="muted">comments already building conversation in this group</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Manage audience members" action={<Badge>{group.memberships.length} in group</Badge>}>
            <div className="stack">
              <form action={addGroupMemberAction} className="form-grid">
                <input type="hidden" name="groupId" value={group.id} />
                <select className="select" name="memberId" defaultValue="">
                  <option value="" disabled>Select member to add</option>
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}{member.phoneMobile ? ` - ${member.phoneMobile}` : ""}
                    </option>
                  ))}
                </select>
                <select className="select" name="role" defaultValue="MEMBER">
                  <option value="MEMBER">Member</option>
                  <option value="ASSISTANT">Assistant</option>
                  <option value="LEADER">Leader</option>
                </select>
                <button className="button secondary" type="submit" disabled={!availableMembers.length}>Add to group</button>
              </form>
              <div className="muted">This group can become a real texting audience for reminders, announcements, prayer chain updates, youth communication, or kids parents.</div>
              <div className="member-stack">
                {group.memberships.length ? (
                  group.memberships.map((membership) => (
                    <div key={membership.id} className="member-row panel panel-soft">
                      <div className="avatar small-avatar">{membership.member.firstName.slice(0, 1)}{membership.member.lastName.slice(0, 1)}</div>
                      <div className="stack" style={{ flex: 1 }}>
                        <div>
                          <strong>{membership.member.firstName} {membership.member.lastName}</strong>
                          <div className="muted">{membership.role}</div>
                          <div className="muted">{membership.member.phoneMobile || membership.member.email || "No phone or email yet"}</div>
                        </div>
                        <form action={removeGroupMemberAction}>
                          <input type="hidden" name="groupId" value={group.id} />
                          <input type="hidden" name="membershipId" value={membership.id} />
                          <button className="button secondary" type="submit">Remove from group</button>
                        </form>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">No members have been attached to this group yet.</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Upcoming group schedule">
            <div className="list compact-list">
              {group.events.length ? (
                group.events.map((event) => (
                  <div key={event.id} className="list-item">
                    <div>
                      <strong>{event.name}</strong>
                      <div className="muted">{formatDateTime(event.startsAt)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="list-item"><span>No upcoming group events scheduled yet.</span></div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Connected ministry workflows">
            <div className="list compact-list">
              <div className="list-item"><span>Send sermon notes only to this group from the Sermons tab.</span></div>
              <div className="list-item"><span>Send Twilio bulk texts to this group from Messages.</span></div>
              <div className="list-item"><span>Send Mailchimp newsletters or segmented email updates from Email.</span></div>
              <div className="list-item"><span>Push daily images, stories, and reels from Automation when this group owns a channel.</span></div>
            </div>
          </SectionCard>
        </div>
      </section>
    </AppShell>
  );
}
