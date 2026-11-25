"use strict";

module.exports = {
  users: [
    {
      name: "Club Admin",
      email: "a@gmail.com",
      password: "123456",
      role: "admin",
      bio: "Club administrator",
    },
    {
      name: "Sita Rai",
      email: "sita@gmail.com",
      password: "123456",
      role: "user",
      bio: "Volunteer",
    },
    {
      name: "Anil Limbu",
      email: "anil@gmail.com",
      password: "123456",
      role: "user",
      bio: "Sports team",
    },
  ],
  about: [
    {
      emoji: "🔥",
      title: "Who we are",
      text: "Shree Yuwa Shakti Club is a youth-led community group that turns energy into action — through sports, learning, and service to our neighbourhood.",
    },
    {
      emoji: "🎯",
      title: "Our mission",
      text: "Give every young person a place to learn, lead, and belong, and use that strength to improve life in our community.",
    },
    {
      emoji: "🌱",
      title: "What we do",
      text: "Clean-up drives, blood donation camps, sports tournaments, skill workshops and cultural festivals all year round.",
    },
  ],
  blogs: [
    {
      title: "Our annual clean-up drive: 120 volunteers, one weekend",
      tag: "Community",
      date: "2026-10-12",
      text: "Over one weekend our members cleared three river banks and planted 200 saplings. Here is how we organised it, and how you can run one in your ward.",
    },
    {
      title: "Inter-club football cup: highlights",
      tag: "Sports",
      date: "2026-09-28",
      text: "Eight clubs, two days, and a penalty shootout nobody will forget. Read the match-by-match story and see who took the trophy home.",
    },
    {
      title: "Free digital skills workshop for students",
      tag: "Learning",
      date: "2026-09-05",
      text: "We taught 60 students to build a CV, use email safely and make their first website. The next batch opens soon.",
    },
  ],
  gallery: [
    { title: "Clean-up drive", url: "", type: "photo", slide: true },
    { title: "Football cup", url: "", type: "photo", slide: true },
    { title: "Blood donation camp", url: "", type: "photo", slide: true },
    { title: "Cultural night", url: "", type: "photo", slide: true },
    { title: "Workshop day", url: "", type: "photo" },
    { title: "Tree plantation", url: "", type: "photo" },
  ],
  banners: [
    { title: "Youth power for a stronger community", sub: "Join Shree Yuwa Shakti Club today" },
    { title: "Annual football cup is coming", sub: "Register your team this month" },
    { title: "Blood donation camp", sub: "Give blood, save lives" },
  ],
  team: [
    { name: "Ram Karki", role: "President" },
    { name: "Sita Rai", role: "Secretary" },
    { name: "Anil Limbu", role: "Treasurer" },
    { name: "Puja Thapa", role: "Coordinator" },
    { name: "Bikash Magar", role: "Sports lead" },
    { name: "Nisha Gurung", role: "Media lead" },
    { name: "Rohan Shah", role: "Volunteer" },
    { name: "Mina Tamang", role: "Volunteer" },
  ],
  groups: [
    { name: "General", desc: "Everyone in the club" },
    { name: "Events team", desc: "Plan upcoming events" },
  ],
  comments: [
    { blogIndex: 0, userEmail: "sita@gmail.com", text: "Great work everyone! Proud to be part of this 🌱" },
    { blogIndex: 1, userEmail: "anil@gmail.com", text: "What a final! Can't wait for next year's cup." },
  ],
  posts: [
    {
      authorEmail: "a@gmail.com",
      category: "Community",
      text: "Welcome to our new club feed! Share photos, videos, stories and go live with the whole club. 🎉",
    },
    {
      authorEmail: "sita@gmail.com",
      category: "Events",
      text: "Clean-up drive this Saturday at 7am. Bring gloves and good energy — we will finish with tea together. 🌱",
    },
  ],
};
