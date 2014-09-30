/**
 * @class Calendar
 *
 * Represents the container which holds a set of events. it is also responsible for calculating and placing the events properly.
 * @author Bernhard Widtmann
 * @notes
 * @example
 * var calendar = new Calendar([{start: 30, end: 150}, {start: 540, end: 600}, {start: 560, end: 620}, {start: 610, end: 670}]);
 * calendar.sortEvents();
 * calendar.calculateEventPositions();
 * calendar.paintEvents();
*/
function Calendar(events) {
    this.width = 600; //max width for events
    //parse raw input data events and store them in calendar
    this.events = [];
    events.forEach(function(event) {
        this.events.push(new Event(event,this)); //events initially have all same width and left
    },this);
	this.events_calculated = []; //two dimensional array of already calculated events that should be finally rendered to calendar
    this.collision_clusters = []; //two dimensional array of all collision clusters already placed on calendar
}
/**
 * Sort all events by start and end time ascending
 * This is important before calculating events for placing on calendar
 */
Calendar.prototype.sortEvents = function() {
	this.events.sort(function(a,b) {
						return ((a.start > b.start) ? 1 : (b.start > a.start) ? -1 :
                               (a.end > b.end) ? 1 : (b.end > a.end) ? -1 : 0);
					});
};
/**
 * Get all colliding events for passed event and column (just evaluate events in corresponding column)
 * @param {Event} event event that has to be placed on calendar
 * @param {Integer} column corresponding column where we want to search for colliding events
 * @returns {Array} colliding events found for passed event and column
 */
Calendar.prototype.getCollidingEvents = function(event, column) {
	var colliding_events = [];
	this.events_calculated[column-1].forEach(function(event_calculated) {
                                            if (event.checkCollision(event_calculated)) {
                                                colliding_events.push(event_calculated);
											}
	},this);
	return colliding_events;
};
/**
 * Get all collision clusters for passed event and merge them together into a big new one
 * @param {Event} event event that has to be placed on calendar
 * @returns {Integer} index of new collision cluster in calendar collision clusters array where event has been placed
 */
Calendar.prototype.determineCollisionClusters = function(event) {
    var new_collision_cluster_index;
    //if there are no collisions -> create new collision cluster
    if (event.collisions.length === 0) {
        new_collision_cluster_index = this.collision_clusters.push([event]) - 1;
    }
    else {
        //go through all collision events and merge them into one collision cluster
        var collision_clusters_to_merge = [];
        event.collisions.forEach(function(collision_event){
            //go through all collision clusters and determine in which current event exists
            this.collision_clusters.forEach(function(collision_cluster,index){
                if ($.inArray(collision_event,collision_cluster) > -1) {
                    collision_clusters_to_merge.push(index);
                    return false;//break;
                }
            });
        },this);
        collision_clusters_to_merge = removeDuplicates(collision_clusters_to_merge);
        new_collision_cluster_index = collision_clusters_to_merge[0];
        //go through clusters (except first) and merge them all into first cluster
        for (var k = 1; k < collision_clusters_to_merge.length; k++) {
            var collision_cluster_to_merge = this.collision_clusters[collision_clusters_to_merge[k]];
            this.collision_clusters[new_collision_cluster_index] = this.collision_clusters[new_collision_cluster_index].concat(collision_cluster_to_merge);
        }
        //finally go through clusters REVERSE that have been merged and remove it
        for (var k = collision_clusters_to_merge.length-1; k > 0 ; k--) {
            this.collision_clusters.splice(collision_clusters_to_merge[k],1);
        }
        //also add current calculated event to current collision cluster
        this.collision_clusters[new_collision_cluster_index].push(event);
    }
    return new_collision_cluster_index;
};
/**
 * Calculate event positions before placing/painting them on calendar
 * This is a simple greedy algorithm
 * Go through all events and place them on calendar as the do not collide
 * Repeat this step for all events that did not find a place on the calendar on first turn (column)
 * Resize all events of collision cluster after event has been placed on calendar
 */
Calendar.prototype.calculateEventPositions = function() {
	// do the calculation until all events have been placed correctly on the calendar	
	var column = 1; //start at column 1 (left = 0)
	while (this.events.length > 0) {
		this.events_calculated[column-1] = [];
        //go through all remaining (not calculated) events
        for (var i = 0; i < this.events.length; i++) {
            var event = this.events[i];
            //check if event has no collisions with other already placed (calculated) events in same column, else skip this event for now
            if (this.getCollidingEvents(event,column).length === 0) {
                //move event from events array to events_calculated array
                //this is a greedy algorithm, so take the best resource for the moment and don't care for further events
                this.events_calculated[column-1].push(event);
                this.events.splice(i--,1);
                event.column = column;

                //determine all events in previous columns that collide with currently placed event (directly)
                event.determineCollidingEvents();
                //determine all collision clusters and merge them into a big new one
                var new_collision_cluster_index = this.determineCollisionClusters(event);

                //go through all events in big new collision cluster and resize them
                this.collision_clusters[new_collision_cluster_index].forEach(function(collision_cluster_event){
                    collision_cluster_event.resize(column);
                },this);
            }
        }
        column++; //no event can be placed in this column anymore -> so go to nex column
    }
};
/**
 * Go through all calculated events (two dimensional array) and paint them on calendar
 */
Calendar.prototype.paintEvents = function() {
    //first remove and (re)append parent div 'calendar' so old events are destroyed
    $(".calendar").remove();
    $(".wrapper").append("<div class='calendar'></div>");
    //then go through all calculated events and paint them under parent div 'calendar'
	this.events_calculated.forEach(function(events) { //ATTENTION: it is a two dimensional array!
							events.forEach(function(event) {
								event.paint();
							});	
						});
};
/**
 * @class Event
 *
 * Represents the event that should be placed on calendar. It's attributes are responsible where the event is placed on calendar to fulfill constraints.
 * @author Bernhard Widtmann
 * @notes
 * @example
 * var event = new Event({start: 30, end: 150},calendar);
 * event.paint();
*/
function Event(event,calendar) {
    this.calendar = calendar; //hold instance of calendar this event should be placed
	this.start = event.start;
	this.end = event.end;
	this.left = 0; //be greedy and start at most left position!
	this.width = this.calendar.width; //be greedy and start always with full width!
    this.collisions = []; //array of events that collide with this event (only directly)
    this.column = 1; //always start at column 1 and increase column if there is no free space anymore in this column on calendar
}
/**
 * Check if passed event collides with this event
 * Colliding means: both events overlap in time in some way
 * @param {Event} event event that is already placed on calendar
 * @returns {Boolean} true if passed event collides with this event
 */
Event.prototype.checkCollision = function(event) {
    return (((this.start <= event.start) && (event.start < this.end))||
        ((this.start < event.end) && (event.end <= this.end))||
        ((event.start <= this.start) && (this.start < event.end))||
        ((event.start < this.end) && (this.end <= event.end)));
};
/**
 * Determine all already placed events that collide directly with this event and store them in collisions array of instance
 * Colliding directly means: this event overlaps with other event in time in some way
 */
Event.prototype.determineCollidingEvents = function() {
    //go through all already filled columns; starting with the current column of this event and go back until column 1
    for (var j = this.column-1; j > 0; j--) {
        var events_colliding = this.calendar.getCollidingEvents(this,j);
        this.collisions = this.collisions.concat(events_colliding);
    }
    //remove duplicates from the final collisions array
    this.collisions = removeDuplicates(this.collisions);
};
/**
 * Resize the attributes of event (width and left) so it fulfills constraints before placing on calendar
 * @param {Integer} column column of event that has triggered the resizing
 */
Event.prototype.resize = function(column) {
    this.width = ((this.calendar.width/column));
    this.left = ((this.width)*(this.column-1));
};
/**
 * Perform a dom tree injection (JQuery) under the parent calendar element with before calculated attributes (top, left, height and width)
 */
Event.prototype.paint = function() {
	$(".calendar").append("<div class='event' style='" + 
						  "top:" + this.start + "px;" +
						  "left:" + this.left + "px;" +
					      "height:" + (this.end - this.start) + "px;" +
						  "width:" + this.width + "px;" + 
						  "'><p>Sample Item</p></div>");
};

/**
 * Helper function to remove duplicate elements in passed array (following DRY)
 * @param {Array} array array to remove duplicate elements
 * @returns {Array} array without duplicate items
 */
removeDuplicates = function(array) {
    array = $.grep(array, function(element, index){
        return $.inArray(element ,array) === index;
    });
    return array;
};
/**
 * Main function in global namespace to start calculating and painting passed events on calendar
 * @param {Array} events array of events consisting of start and end time ({start:10,end:150})
 */
function layOutDay(events) {
	var calendar = new Calendar(events);
	calendar.sortEvents();
	calendar.calculateEventPositions();
	calendar.paintEvents();
}

layOutDay([{start: 30, end: 150}, {start: 540, end: 600}, {start: 560, end: 620}, {start: 610, end: 670}]);

