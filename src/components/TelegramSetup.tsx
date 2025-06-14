
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bot, MessageCircle, Shield, CheckCircle, Webhook, Copy } from 'lucide-react';

const TelegramSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [botToken, setBotToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (user) {
      checkExistingConfig();
      // Set webhook URL using the direct Supabase URL
      setWebhookUrl('https://ewfiglrjzombjbirwgoi.supabase.co/functions/v1/telegram-webhook');
    }
  }, [user]);

  const checkExistingConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('user_telegram_config')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (data && !error) {
        setIsConfigured(true);
        setChannelId(data.channel_id);
        // Don't show the bot token for security
      }
    } catch (error) {
      // No existing config, which is fine
    } finally {
      setCheckingConfig(false);
    }
  };

  const setupWebhook = async () => {
    if (!botToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter your bot token first",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to setup webhook",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Setting up webhook for bot token:', botToken.substring(0, 10) + '...');
      
      const { data, error } = await supabase.functions.invoke('telegram-setup-webhook', {
        body: { botToken: botToken.trim() }
      });

      if (error) {
        console.error('Webhook setup error:', error);
        throw new Error(error.message || 'Failed to setup webhook');
      }

      if (!data?.success) {
        console.error('Webhook setup failed:', data);
        throw new Error(data?.error || 'Failed to setup webhook');
      }

      console.log('Webhook setup successful:', data);
      toast({
        title: "Success!",
        description: "Webhook has been set up successfully",
      });
    } catch (error: any) {
      console.error('Webhook setup error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to setup webhook",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim() || !channelId.trim()) {
      toast({
        title: "Error",
        description: "Please fill in both bot token and channel ID",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to configure Telegram integration",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Starting Telegram setup for user:', user.id);
      
      // First setup webhook
      console.log('Setting up webhook...');
      const { data: webhookResult, error: webhookError } = await supabase.functions.invoke('telegram-setup-webhook', {
        body: { botToken: botToken.trim() }
      });

      if (webhookError) {
        console.error('Webhook setup error:', webhookError);
        throw new Error(webhookError.message || 'Failed to setup webhook');
      }

      if (!webhookResult?.success) {
        console.error('Webhook setup failed:', webhookResult);
        throw new Error(webhookResult?.error || 'Failed to setup webhook');
      }

      console.log('Webhook setup successful, testing config...');

      // Test the bot configuration
      const { data: testResult, error: testError } = await supabase.functions.invoke('telegram-test-config', {
        body: {
          botToken: botToken.trim(),
          channelId: channelId.trim(),
          userId: user.id,
        },
      });

      if (testError) {
        console.error('Config test error:', testError);
        throw new Error(testError.message || 'Failed to verify bot configuration');
      }

      if (!testResult?.success) {
        console.error('Config test failed:', testResult);
        throw new Error(testResult?.error || 'Failed to verify bot configuration');
      }

      console.log('Config test successful, saving to database...');

      // If test passes, save to database
      const { error: dbError } = await supabase
        .from('user_telegram_config')
        .upsert({
          user_id: user.id,
          bot_token: botToken.trim(),
          channel_id: channelId.trim(),
          is_active: true,
        });

      if (dbError) {
        console.error('Database save error:', dbError);
        throw new Error(dbError.message || 'Failed to save configuration');
      }

      console.log('Configuration saved successfully');
      setIsConfigured(true);
      setBotToken(''); // Clear for security
      toast({
        title: "Success!",
        description: "Telegram integration configured successfully with webhook",
      });
    } catch (error: any) {
      console.error('Setup error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to configure Telegram integration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_telegram_config')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      setIsConfigured(false);
      setChannelId('');
      setBotToken('');
      toast({
        title: "Disconnected",
        description: "Telegram integration has been disconnected",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to disconnect Telegram integration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
    });
  };

  if (checkingConfig) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Checking Telegram configuration...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>Telegram Integration Active</span>
          </CardTitle>
          <CardDescription>
            Your Telegram channel is connected and ready to store files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Channel ID</Label>
            <Input value={channelId} disabled />
          </div>
          <div>
            <Label>Webhook URL</Label>
            <div className="flex space-x-2">
              <Input value={webhookUrl} disabled />
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Button variant="destructive" onClick={handleDisconnect} disabled={loading}>
            {loading ? 'Disconnecting...' : 'Disconnect Telegram'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bot className="w-5 h-5" />
          <span>Setup Telegram Storage</span>
        </CardTitle>
        <CardDescription>
          Connect your Telegram bot/channel to use it as unlimited cloud storage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4" />
              <span>Setup Instructions:</span>
            </h4>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Create a new bot by messaging @BotFather on Telegram</li>
              <li>Get your bot token from BotFather</li>
              <li>Create a private channel or use an existing one</li>
              <li>Add your bot as an administrator to the channel</li>
              <li>Get your channel ID (start with -100 for supergroups)</li>
              <li>The webhook will be automatically configured</li>
            </ol>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium flex items-center space-x-2 mb-2">
              <Webhook className="w-4 h-4" />
              <span>Webhook URL (Auto-configured):</span>
            </h4>
            <div className="flex space-x-2">
              <Input value={webhookUrl} disabled className="text-xs" />
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">Bot Token</Label>
            <Input
              id="botToken"
              type="password"
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channelId">Channel ID</Label>
            <Input
              id="channelId"
              placeholder="-1001234567890"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={setupWebhook}
              disabled={loading || !botToken.trim()}
              className="flex-1"
            >
              <Webhook className="w-4 h-4 mr-2" />
              {loading ? 'Setting up...' : 'Setup Webhook Only'}
            </Button>
            
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Configuring...' : 'Complete Setup'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TelegramSetup;
