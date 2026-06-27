export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    clerkKey: process.env.CLERK_PUBLISHABLE_KEY || ''
  });
}
