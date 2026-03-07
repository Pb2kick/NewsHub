
# NewsHub Frontend

This is the React frontend for the NewsHub project. It provides user authentication and a platform for news aggregation and sharing, powered by Supabase.

## Features

- User registration and login (Supabase authentication)
- Clean, modern UI
- Easy integration with backend
- Modular code structure for easy development

## Getting Started

1. Clone the repository:
	```bash
	git clone https://github.com/<your-username>/NewsHub.git
	cd NewsHub/frontend
	```
2. Install dependencies:
	```bash
	npm install
	```
3. Set up environment variables:
	- Create a `.env` file in the `frontend` directory.
	- Add your Supabase credentials:
	  ```
	  REACT_APP_SUPABASE_URL=your_supabase_url
	  REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
	  ```
4. Start the development server:
	```bash
	npm start
	```
	The app will be available at [http://localhost:3000](http://localhost:3000).

## Safe Development Guidelines

- Always create a new branch for your feature or bugfix:
  ```bash
  git checkout -b feature/your-feature-name
  ```
- Commit changes with clear messages.
- Pull the latest changes from `main` before starting work:
  ```bash
  git pull origin main
  ```
- Push your branch and open a pull request for review.
- Avoid direct commits to `main` unless necessary.
- Do not share `.env` or sensitive credentials in the repository.

## Contributing

1. Fork the repository if you are not a direct collaborator.
2. Follow the safe development guidelines above.
3. Review and test your code before submitting a pull request.

## Project Structure

- `src/` - Main source code
- `public/` - Static assets
- `.env` - Environment variables (not committed)

## Database (ERD-aligned)

- ERD SQL migration file: [database/migrations/001_erd_users_verifications.sql](database/migrations/001_erd_users_verifications.sql)
- Apply it in Supabase:
	1. Open Supabase Dashboard → SQL Editor.
	2. Paste the contents of `database/migrations/001_erd_users_verifications.sql`.
	3. Run the script once to create `users` and `verifications` with constraints.

This migration enforces:
- Unique email in `users` (case-insensitive)
- One verification per user (`verifications.user_id` is unique)
- `status` enum-like constraint (`PENDING | APPROVED | REJECTED`)
- Admin reviewer foreign key (`reviewed_by_admin_id` → `users.id`)

It also adds Supabase integration behavior:
- New `auth.users` signups are mirrored into `public.users` via DB trigger.
- Email/password/name updates in `auth.users` are synced to `public.users`.
- A secure RPC `public.submit_verification(...)` is added for authenticated users.

Example RPC call from frontend after login:

```js
const { data, error } = await supabase.rpc('submit_verification', {
	p_full_name: fullName,
	p_address: address,
	p_birthdate: birthdate,
	p_photo_id_url: photoIdUrl,
});
```
