# API Credits Exhausted - How to Fix

## The Issue

You're seeing this error:
```
API returned status 429
Credits exhausted
```

This means your Lyzr API account has run out of credits.

## Console Errors Explained

The console shows:
- `← 429 POST /api/agent` - HTTP 429 = "Too Many Requests" (rate limit/credits exhausted)
- `"detail":"Credits exhausted"` - Your API key has no remaining credits

## How to Fix

### Option 1: Add Credits to Your Account
1. Log in to your Lyzr account at https://studio.lyzr.ai
2. Navigate to your account/billing section
3. Purchase additional API credits
4. Your agents will start working immediately once credits are added

### Option 2: Use a Different API Key
If you have another Lyzr account with credits:
1. Get the API key from that account
2. Update your `.env.local` file:
   ```env
   LYZR_API_KEY=your_new_api_key_here
   ```
3. Restart your Next.js development server

### Option 3: Contact Lyzr Support
If you believe this is an error or need help:
- Contact Lyzr support at: https://www.lyzr.ai/contact
- Mention your account email and the agents you're trying to use

## Current Agent IDs

Your application uses these agents:
- **Scanner Agent**: `698589a41caa4e686dd66e59`
- **Equalizer Agent**: `698589c1a791e6e318b8de57`
- **Emailer Agent**: `698589e6a791e6e318b8de60`

All three agents require API credits to function.

## What's Working

The good news:
- ✅ File upload is working perfectly
- ✅ PDF files are being uploaded successfully
- ✅ The UI is functioning correctly
- ✅ Error handling is showing clear messages

The only issue is the API credit limitation.

## Test Without Credits

Unfortunately, you cannot test the agents without credits. However, you can:
1. Verify the UI layout and design
2. Test file upload functionality
3. Check the "Load Sample Contract" feature
4. Review the code structure

## Updated Error Handling

I've improved the error messages to clearly indicate when credits are exhausted:
- Red banner appears at the top
- Clear message: "API Credits exhausted. Please contact support to add more credits to your account."
- Console still logs full error details for debugging

## Environment Check

Make sure your `.env.local` file has:
```env
LYZR_API_KEY=your_actual_api_key
```

## Next Steps

1. Add credits to your Lyzr account
2. The application will work immediately
3. All three agents (Scanner, Equalizer, Emailer) will process your contracts
4. You can test with either:
   - The sample contract (click "Load Sample Contract")
   - Your own PDF files (upload via drag-drop or click)

## Support

For credit-related issues:
- Lyzr Support: https://www.lyzr.ai/contact
- Documentation: https://docs.lyzr.ai

For code issues:
- Check the console for detailed error logs
- All agent responses are logged with `console.log`
- Error states are clearly displayed in the UI
