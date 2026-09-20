import { redirect } from 'next/navigation'

// Thinnai creation is now folded into the unified home screen at `/`.
export default function CreateThinnaiPage() {
  redirect('/')
}
