'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createOrganizationAction } from '../actions';

export function CreateOrganizationForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const result = await createOrganizationAction({}, formData);

    if ('error' in result && result.error) {
      toast.error(result.error);
      setIsSubmitting(false);
    } else if ('success' in result && result.success && result.organization) {
      setShowSuccess(true);
      toast.success('Organization created successfully');
      setTimeout(() => {
        router.push(`/app/organizations/${result.organization.id}`);
      }, 800);
    }
  };

  if (showSuccess) {
    return (
      <Card className="border-green-500/20 bg-green-500/5 animate-in fade-in duration-300">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4 animate-in zoom-in duration-300" />
          <h3 className="text-lg font-semibold mb-2">Organization created!</h3>
          <p className="text-sm text-muted-foreground">Redirecting to organizations...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Enter organization name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Enter organization description"
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                placeholder="Enter location"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="type">Organization type</Label>
              <Select name="type">
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Church">Church</SelectItem>
                  <SelectItem value="Community Group">Community group</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Nonprofit">Nonprofit</SelectItem>
                  <SelectItem value="School">School</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Organization Size</Label>
              <Input
                id="size"
                name="size"
                placeholder="e.g., 1-10, 50-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue="Potential Lead">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Potential Lead">0) Potential Lead</SelectItem>
                  <SelectItem value="Contact Made">1) Contact Made</SelectItem>
                  <SelectItem value="Active Members">2) Active Members</SelectItem>
                  <SelectItem value="Starting Church Team">3) Starting Church Team</SelectItem>
                  <SelectItem value="Active Church Team">4) Active Church Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/app/organizations')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
