const MONDAY_API_URL = 'https://api.monday.com/v2';

const DEFAULT_BOARD_ID = 18398556616;

export interface MondayClient {
  createBillItem(bill: {
    bill_id: string;
    title: string;
    topic?: string | null;
    house_location?: string | null;
    committee_location?: string | null;
    source_url?: string | null;
    lead_authors?: string | null;
  }): Promise<{ id: string; name: string }>;
}

export function createMondayClient(apiToken: string, boardId?: string | null): MondayClient {
  const resolvedBoardId = boardId ? parseInt(boardId, 10) : DEFAULT_BOARD_ID;

  async function mondayQuery(query: string, variables?: Record<string, any>) {
    const res = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Monday.com API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (data.errors?.length) {
      throw new Error(`Monday.com: ${data.errors[0].message}`);
    }
    return data.data;
  }

  return {
    async createBillItem(bill) {
      const itemName = `${bill.bill_id} — ${bill.title}`;

      const columnValues: Record<string, any> = {
        color_mm0ndzbd: { label: 'Medium' },
        status: { label: 'Not Started' },
        date4: { date: new Date().toISOString().split('T')[0] },
      };

      const details = [
        bill.topic && `Topic: ${bill.topic}`,
        bill.house_location && `Location: ${bill.house_location}`,
        bill.committee_location && `Committee: ${bill.committee_location}`,
        bill.lead_authors && `Authors: ${bill.lead_authors}`,
        bill.source_url && `Leginfo: ${bill.source_url}`,
      ]
        .filter(Boolean)
        .join('\n');

      const query = `
        mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!, $groupId: String) {
          create_item(
            board_id: $boardId
            item_name: $itemName
            column_values: $columnValues
            group_id: $groupId
          ) {
            id
            name
          }
        }
      `;

      const result = await mondayQuery(query, {
        boardId: resolvedBoardId.toString(),
        itemName: itemName.length > 255 ? itemName.slice(0, 252) + '...' : itemName,
        columnValues: JSON.stringify(columnValues),
        groupId: 'topics',
      });

      if (details) {
        await mondayQuery(
          `mutation ($itemId: ID!, $body: String!) {
            create_update(item_id: $itemId, body: $body) { id }
          }`,
          { itemId: result.create_item.id, body: details }
        );
      }

      return result.create_item;
    },
  };
}
