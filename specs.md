This is the sample HTML content for the card in the indiamart page

U can get the parent of the element which holds all the card using id "bl_listing"

Every card in that parent will have id of template "list{number}"
The number increases sequentialy
For example the first card id will be "list1"


The infos u need to extract from user based on which u should buy the lead

- Refresh Interval for page in Sec ( Default value is 15 secs )
- Min Time passed in minutes ( Default value is 10 mins )
- Min Order value ( Default value is 100 pece )
- Order value ( Default value is 20000 Rs )

U need to extract four things from every card

- Location
- Quantity
- Order Value
- Duration passed after posting the lead
- CTA button which buys the lead

There can mutiple variation in which info is there is card
make sure change u get the info to single unit
for example : 1 day to 1440 min
So that we can compare to info from user and card properly

The variation of Info u can get from card are

Duration passed after posting the lead
- 1 sec ago
- 15 secs ago
- 1 min ago
- 7 mins ago
- 1 hr ago
- 2 hrs ago
- 3 Days Old
- Yesterday

Quantity
- 30 Piece

Order value
- Rs. 1 to 2 Lakh
- Rs. 20,000 to 50,000


Lead Buying Criteria's 

- If the lead time passed is less than time given by user
- Either the order quantity from card is greater than min order quantity from user or order value from card is greater than min order value from user
- The location should contain one the word in this list
 - Tamil Nadu
 - Karnataka
 - Andhra
 - Kerala

Once u buy the lead U sen notify by doing something add that funtion which accepts the lead payload as of now and keep it body of the function empty as of now , It will developed in the future


The Extesnion should have UI to info from user in minimal styling
Should have also start and stop button for refreshing and running checks
Heve timer UI running on the top telling how much time running before executing the next refresh
The Cycle should repeat everytime time ends , refresh the tab , wait for bl_listing id check the criteria matching if matches buy or els wait for timer to end and refresh again